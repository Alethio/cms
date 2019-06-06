import { AsyncData } from "./AsyncData";
import { Task } from "@puzzl/core/lib/async/Task";
import { IDataWatcher } from "plugin-api/IDataWatcher";
import { action } from "mobx";
import { OperationCanceledError, CancellationToken } from "@puzzl/core/lib/async/cancellation";
import { IDataAdapter } from "plugin-api/IDataAdapter";
import { MixedCollection } from "./MixedCollection";
import { ILogger } from "plugin-api/ILogger";

export class DataLoader<TDataAdapterType, TContext> {
    private asyncData = new Map<TDataAdapterType, AsyncData<unknown>>();
    private dataFetchTasks = new Map<TDataAdapterType, Task<void>>();
    private dataRefreshCallbacks = new Map<TDataAdapterType, () => void>();
    private dataWatchers = new Map<TDataAdapterType, IDataWatcher[]>();
    private context: TContext;

    constructor(
        private dataAdapterTypes: TDataAdapterType[],
        public dataAdapters: MixedCollection<TDataAdapterType, IDataAdapter<TContext, unknown>>,
        private logger: ILogger,
        private resetOnFetch = false
    ) {
        this.dataAdapterTypes.forEach(dataAdapterType => {
            this.asyncData.set(dataAdapterType, new AsyncData());
            this.dataRefreshCallbacks.set(dataAdapterType, () => this.updateData(dataAdapterType, this.context, true));
        });
    }

    load(context: TContext) {
        this.context = context;
        this.dataAdapterTypes.forEach(dataAdapterType => this.destroyWatcher(dataAdapterType));
        this.dataAdapterTypes.forEach(dataAdapterType => this.updateData(dataAdapterType, this.context));
    }

    dispose() {
        [...this.dataFetchTasks.values()].forEach(task => task.cancel());
        this.dataAdapterTypes.forEach(dataAdapterType => this.destroyWatcher(dataAdapterType));
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
    }

    private fetchData(dataAdapterType: TDataAdapterType, context: TContext,
        isWatcherRefresh: boolean, cancelToken: CancellationToken) {
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

        let dataAdapter = this.dataAdapters.get(dataAdapterType);
        return dataAdapter.load(context, cancelToken)
            .catch(e => {
                if (e instanceof OperationCanceledError) {
                    throw e;
                }
                this.logger.error(`Couldn't fetch data (context = ${JSON.stringify(context)})`, e);
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
            });
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
