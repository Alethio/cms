import * as taskGraphRunner from "task-graph-runner";
import { AsyncData } from "./AsyncData";
import { Task } from "@puzzl/core/lib/async/Task";
import { IDataWatcher } from "plugin-api/IDataWatcher";
import { action } from "mobx";
import { OperationCanceledError, CancellationToken } from "@puzzl/core/lib/async/cancellation";
import { IDataAdapter } from "plugin-api/IDataAdapter";
import { MixedCollection } from "./MixedCollection";
import { ILogger } from "plugin-api/ILogger";

export class DataLoader<TContext, TDataAdapterType extends string = string> {
    private asyncData = new Map<TDataAdapterType, AsyncData<unknown>>();
    private dataFetchTasks = new Map<TDataAdapterType, Task<void>>();
    private dataRefreshCallbacks = new Map<TDataAdapterType, () => void>();
    private dataWatchers = new Map<TDataAdapterType, IDataWatcher[]>();
    private context: TContext;
    private depsMap: Map<TDataAdapterType, TDataAdapterType[]>;

    constructor(
        dataAdapterTypes: TDataAdapterType[],
        public dataAdapters: MixedCollection<TDataAdapterType, IDataAdapter<TContext, unknown>>,
        private logger: ILogger,
        private resetOnFetch = false
    ) {
        this.depsMap = this.buildDepsMap(dataAdapterTypes);
        let allAdapterTypes = [...this.depsMap.keys()];
        allAdapterTypes.forEach(dataAdapterType => {
            this.asyncData.set(dataAdapterType, new AsyncData());
            this.dataRefreshCallbacks.set(dataAdapterType, () => this.updateData(dataAdapterType, this.context, true));
        });
    }

    /**
     * Builds a map describing the data adapter dependency graph.
     * This is the format accepted by the library that resolves the load order of the dependencies
     *
     * See https://www.npmjs.com/package/task-graph-runner for examples
     */
    private buildDepsMap(adapterTypes: TDataAdapterType[]) {
        let depsMap = new Map<TDataAdapterType, TDataAdapterType[]>();
        let unvisitedNodes = adapterTypes;
        let visitedNodes = new Set<TDataAdapterType>();
        while (unvisitedNodes.length) {
            let current = unvisitedNodes.shift()!;
            if (visitedNodes.has(current)) {
                continue;
            }
            visitedNodes.add(current);
            let currentDeps = (this.dataAdapters.get(current)!.dependencies || []) as TDataAdapterType[];
            depsMap.set(current, currentDeps);
            unvisitedNodes.push(...currentDeps);
        }
        return depsMap;
    }

    load(context: TContext) {
        this.context = context;
        // Load the data adapters in parallel, in the order dictated by their required dependencies
        taskGraphRunner({
            graph: this.depsMap,
            task: async (adapterType) => {
                this.destroyWatcher(adapterType);
                await this.updateData(adapterType, this.context);
            }
        }).catch(e => {
            this.logger.error(e);
        });
    }

    dispose() {
        [...this.dataFetchTasks.values()].forEach(task => task.cancel());
        [...this.depsMap.keys()].forEach(dataAdapterType => this.destroyWatcher(dataAdapterType));
    }

    @action
    private updateData(dataAdapterType: TDataAdapterType, context: TContext, isWatcherRefresh = false) {
        if (this.dataFetchTasks.has(dataAdapterType)) {
            this.dataFetchTasks.get(dataAdapterType)!.cancel();
        }

        let dataFetchTask = new Task(
            async (cancelToken) => this.fetchData(dataAdapterType, context, isWatcherRefresh, cancelToken)
                .catch(e => {
                    if (!(e instanceof OperationCanceledError)) {
                        throw e;
                    }
                })
        );
        dataFetchTask.start()
            .catch(e => this.logger.error(e));

        this.dataFetchTasks.set(dataAdapterType, dataFetchTask);

        return dataFetchTask.wait();
    }

    private fetchData(dataAdapterType: TDataAdapterType, context: TContext,
        isWatcherRefresh: boolean, cancelToken: CancellationToken
    ) {
        // reset data only for top-level contexts, otherwise we get flickering when refreshing data
        // Also reset with a small delay, in case the load is instant, to avoid an unnecessary render
        let resetRafId: number | undefined;
        if (this.resetOnFetch && !isWatcherRefresh) {
            resetRafId = requestAnimationFrame(() => {
                resetRafId = void 0;
                if (cancelToken.isCancelled()) {
                    return;
                }
                this.asyncData.get(dataAdapterType)!.reset();
            });
        }

        if (!this.dataAdapters.has(dataAdapterType)) {
            throw new Error(`Data adapter "${dataAdapterType}" is not exposed by any plugin`);
        }

        let dataAdapter = this.dataAdapters.get(dataAdapterType);
        return Promise.resolve(this.getDepAdapterData(dataAdapter))
            .then(depData => {
                if (!depData) {
                    return void 0;
                }
                return dataAdapter.load(context, cancelToken, depData);
            })
            .catch(e => {
                if (e instanceof OperationCanceledError) {
                    throw e;
                }
                this.logger.error(`Couldn't fetch data from adapter "${dataAdapterType}"`, e, { context });
                return void 0;
            })
            .then(data => {
                cancelToken.throwIfCancelled();
                if (resetRafId !== void 0) {
                    cancelAnimationFrame(resetRafId);
                    resetRafId = void 0;
                }
                this.asyncData.get(dataAdapterType)!.update(data);
                this.setupWatcher(dataAdapterType, context, data);
                if (isWatcherRefresh) {
                    this.refreshDependentAdapters(dataAdapterType, context);
                }
            });
    }

    private refreshDependentAdapters(dataAdapterType: TDataAdapterType, context: TContext) {
        this.depsMap.forEach((deps, dependant) => {
            if (deps.indexOf(dataAdapterType) !== -1) {
                // tslint:disable-next-line: no-floating-promises
                this.updateData(dependant, context, true);
            }
        });
    }

    /**
     * Get the resolved data from loaded dependencies of the given data adapter.
     * @param dataAdapter
     */
    private getDepAdapterData(dataAdapter: IDataAdapter<TContext, unknown>) {
        let dataAdapterDepTypes = (dataAdapter.dependencies || []) as TDataAdapterType[];
        let depData = new Map<string, unknown>();
        for (let depAdapterType of dataAdapterDepTypes) {
            let asyncData = this.asyncData.get(depAdapterType)!;
            if (asyncData.isLoading()) {
                throw new Error(`Adapter dependency "${depAdapterType}" should have been loaded by now.`);
            }
            if (!asyncData.isLoaded()) {
                return void 0;
            }
            depData.set(depAdapterType, asyncData.data);
        }
        return depData;
    }

    private setupWatcher(dataAdapterType: TDataAdapterType, context: TContext, lastData: unknown) {
        this.destroyWatcher(dataAdapterType);

        let dataAdapter = this.dataAdapters.get(dataAdapterType);
        if (dataAdapter.createWatcher) {
            let createWatcherResult = dataAdapter.createWatcher(context, lastData);
            let dataWatchers = Array.isArray(createWatcherResult) ? createWatcherResult : [createWatcherResult];
            dataWatchers.forEach(dataWatcher => {
                dataWatcher.watch();
                dataWatcher.onData.subscribe(this.dataRefreshCallbacks.get(dataAdapterType)!);
            });
            this.dataWatchers.set(dataAdapterType, dataWatchers);
        }
    }

    private destroyWatcher(dataAdapterType: TDataAdapterType) {
        let dataWatchers = this.dataWatchers.get(dataAdapterType);
        if (dataWatchers) {
            dataWatchers.forEach(dataWatcher => {
                dataWatcher.onData.unsubscribe(this.dataRefreshCallbacks.get(dataAdapterType)!);
                dataWatcher.unwatch();
            });
        }
    }

    getData() {
        return this.asyncData;
    }
}
