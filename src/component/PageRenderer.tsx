import * as React from "react";
import { Route, BrowserRouter, Switch, Redirect } from "react-router-dom";
import { observer, Observer } from "mobx-react";
import { ILogger } from "plugin-api/ILogger";
import { SidebarMobileStore } from "../SidebarMobileStore";
import { PageWrapper } from "./PageWrapper";
import { IModule } from "../IModule";
import { IContentProps } from "plugin-api/IContentProps";
import { LiveData } from "./LiveData";
import { ILiveContentProps } from "./ILiveContentProps";
import { IPage } from "../IPage";
import { IDataAdapter } from "plugin-api/IDataAdapter";
import { MixedCollection } from "../MixedCollection";
import { DataLoader } from "../DataLoader";
import { DataContext } from "./DataContext";
import { IContext } from "../IContext";
import { ErrorBoundary } from "@alethio/ui/lib/util/react/ErrorBoundary";
import { IDataAdapterConfig, IDataAdapterRefConfig } from "plugin-api/IDataAdapterConfig";
import { IPageTemplateProps } from "plugin-api/IPageDef";
import { IPlugin } from "plugin-api/IPlugin";
import { ILinkContext, LinkContext } from "./LinkContext";
import { mapModuleData } from "../mapModuleData";
import { PluginTranslationStore } from "../PluginTranslationStore";

export interface IRootPageProps<TSlotType extends string | number> {
    /** Placeholder where the CMS renders the routes (pages) */
    routes: JSX.Element;
    /** The state of the mobile sidebar */
    sidebarMobileStore: SidebarMobileStore;
    /** Placeholders for other modules that are placed at the root of the page */
    slots?: Record<TSlotType, JSX.Element[]>;
}

export interface IPageRendererProps<TRootSlotType extends string | number> {
    plugins: MixedCollection<string, IPlugin>;
    dataAdapters: MixedCollection<string, IDataAdapter<unknown, unknown>>;
    pages: IPage<any, any>[];
    rootModules: Record<TRootSlotType, IModule<any, {}>[]>;
    logger: ILogger;
    locale: string;
    defaultLocale: string;
    children(props: IRootPageProps<TRootSlotType>): React.ReactNode;
    renderErrorPage(): React.ReactNode;
    renderErrorPlaceholder(): JSX.Element | null;
    renderLoadingPlaceholder(): JSX.Element | null;
}

@observer
export class PageRenderer<TRootSlotType extends string | number>
extends React.Component<IPageRendererProps<TRootSlotType>> {
    private translationStore: PluginTranslationStore;
    private sidebarMobileStore: SidebarMobileStore;
    private dataLoaders = new Map<IContext<any, any> | IPage<any, any> | string, DataLoader<string, unknown>>();

    private linkContext: ILinkContext;
    private rootContext = {};
    private toolbarUiState = {};

    constructor(props: IPageRendererProps<TRootSlotType>) {
        super(props);

        this.sidebarMobileStore = new SidebarMobileStore();

        this.linkContext = {
            pages: this.props.pages
        };

        this.translationStore = new PluginTranslationStore(this.props.plugins, this.props.defaultLocale);

        this.translationStore.loadTranslations(this.props.locale)
            .catch(e => this.props.logger.error(e));
    }

    componentDidUpdate(prevProps: IPageRendererProps<TRootSlotType>) {
        if (this.props.locale !== prevProps.locale) {
            this.translationStore.loadTranslations(this.props.locale)
                .catch(e => this.props.logger.error(e));
        }
    }

    public render() {
        if (!this.translationStore.isLoaded()) {
            return null;
        }

        let context = this.rootContext;
        let uiStateContainer = this.toolbarUiState;
        let rootModules = this.props.rootModules;

        let dataAdapterTypes = [...this.collectDataAdapterTypes(rootModules)];
        let dataLoader = this.createDataLoader("internal://root", dataAdapterTypes, this.props.dataAdapters);

        let slots = this.renderChildren(rootModules, dataLoader, context, uiStateContainer);

        return <LinkContext.Provider value={this.linkContext}>
            <BrowserRouter>
                <DataContext context={context} dataLoader={dataLoader}>
                    { this.props.children({
                        routes: this.renderPages(),
                        slots,
                        sidebarMobileStore: this.sidebarMobileStore
                    }) }
                </DataContext>
            </BrowserRouter>
        </LinkContext.Provider>;
    }

    private renderPages() {
        return <Switch>
            { this.props.pages.reduce<JSX.Element[]>((routes, page) => {
                routes.push(...this.renderPageRoutes(page));
                return routes;
            }, [])}
            <Route render={() => this.props.renderErrorPage()} />
        </Switch>;
    }

    private renderPageRoutes<TSlotType extends string | number, TContext>(
        page: IPage<TSlotType, TContext>
    ) {
        let paths = page.def.paths;
        return Object.keys(paths).map(path => (
            <Route exact key={path} path={path} render={
                ({ match }) => {
                    const createContext = paths[path];
                    if (typeof createContext === "function") {
                        let context = createContext(match.params);
                        if (!context) {
                            return this.props.renderErrorPage();
                        }
                        if (typeof context === "string") {
                            return <Redirect to={context} />;
                        }

                        return this.renderPageContent<TSlotType, TContext>(page, context);
                    } else {
                        let dataAdapterTypes = createContext.dataAdapters.map(adapter => adapter.ref);
                        let dataLoader = this.createDataLoader(
                            path, dataAdapterTypes, this.props.dataAdapters);
                        return <DataContext context={match.params} dataLoader={dataLoader}>
                            <Observer>
                                {() => {
                                    if ([...dataLoader.getData().values()].some(v => !v.isLoaded())) {
                                        return null;
                                    }
                                    let context = createContext.create(match.params, dataLoader.getData());
                                    if (!context) {
                                        return null;
                                    }
                                    return this.renderPageContent<TSlotType, TContext>(page, context);
                                }}
                            </Observer>
                        </DataContext>;
                    }
                }
            } />
        ));
    }

    private createDataLoader<TContext>(
        cacheKey: IContext<any, TContext> | IPage<any, TContext> | string,
        dataAdapterTypes: string[],
        dataAdapters: MixedCollection<string, IDataAdapter<TContext, unknown>>,
        isRoot?: boolean
    ) {
        if (this.dataLoaders.has(cacheKey)) {
            return this.dataLoaders.get(cacheKey)! as DataLoader<string, TContext>;
        }
        let dataLoader = new DataLoader<string, TContext>(
            dataAdapterTypes,
            dataAdapters,
            this.props.logger,
            isRoot
        );
        this.dataLoaders.set(cacheKey, dataLoader);
        return dataLoader;
    }

    private collectDataAdapterTypes<TContext>(
        children: Record<any, (IModule<any, TContext, any> | IContext<TContext, any>)[]>
    ) {
        let dataAdapterTypes = new Set<string>();
        Object.values(children).forEach(modules => {
            modules.forEach(m => {
                if (this.isContext(m)) {
                    m.def.dataAdapters.map(adapter => adapter.ref).forEach(t => dataAdapterTypes.add(t));
                } else {
                    m.def.dataAdapters.map((adapter, i) => {
                        if (this.isRefAdapterConfig(adapter)) {
                            return adapter.ref;
                        } else {
                            let adapterName = `local-adapter://${m.uuid}/${i}`;
                            this.props.dataAdapters.add(adapterName, adapter.def);
                            return adapterName;
                        }
                    }).forEach(t => dataAdapterTypes.add(t));
                }
                if (this.isContext(m) || !m.children) {
                    return;
                }
                this.collectDataAdapterTypes<TContext>(m.children).forEach(t => dataAdapterTypes.add(t));
            });
        });
        return dataAdapterTypes;
    }

    private collectPageCriticalDataAdapterTypes<TContext>(
        children: Record<any, (IModule<any, TContext, any> | IContext<TContext, any>)[]>
    ) {
        let dataAdapterTypes = new Set<string>();
        Object.values(children).forEach(modules => {
            modules.forEach(m => {
                if (m.pageCritical) {
                    if (this.isContext(m)) {
                        m.def.dataAdapters
                            .filter(d => !d.optional)
                            .map(adapter => adapter.ref)
                            .forEach(t => dataAdapterTypes.add(t));
                    } else {
                        m.def.dataAdapters.filter(d => !d.optional).map((adapter, i) => {
                            if (this.isRefAdapterConfig(adapter)) {
                                return adapter.ref;
                            } else {
                                let adapterName = `local-adapter://${m.uuid}/${i}`;
                                this.props.dataAdapters.add(adapterName, adapter.def);
                                return adapterName;
                            }
                        }).forEach(t => dataAdapterTypes.add(t));
                    }
                }
                if (this.isContext(m) || !m.children) {
                    return;
                }
                this.collectPageCriticalDataAdapterTypes<TContext>(m.children).forEach(t => dataAdapterTypes.add(t));
            });
        });
        return dataAdapterTypes;
    }

    private isPromise<T>(thunk: T | Promise<T>): thunk is Promise<T> {
        return !!(thunk as Promise<T>).then;
    }

    private renderPageContent<TSlotType extends string | number, TContext>(
        page: IPage<TSlotType, TContext>,
        context: TContext
    ) {
        let dataAdapterTypes = [...this.collectDataAdapterTypes<TContext>(page.children)];
        let dataLoader = this.createDataLoader(page, dataAdapterTypes, this.props.dataAdapters, true);

        let PageTemplate = page.def.getPageTemplate();

        let pageProps: IPageTemplateProps<TSlotType> = {
            translation: this.translationStore.getTranslations(page.pluginUri),
            sidebarVisible: this.sidebarMobileStore.isSidebarVisible,
            slots: this.renderChildren(page.children, dataLoader, context, page.uiStateContainer),
            options: page.options
        };

        let pageCriticalAdapterTypes = [...this.collectPageCriticalDataAdapterTypes(page.children)];

        let pageElement: JSX.Element;

        if (this.isPromise(PageTemplate) || pageCriticalAdapterTypes.length) {
            let contentComponentPromise = Promise.resolve(PageTemplate).then(C =>
                (liveProps: IPageTemplateProps<TSlotType>) => <C {...liveProps} />
            );

            const getErrorPlaceholder = page.def.getErrorPlaceholder;
            const getLoadingPlaceholder = page.def.getLoadingPlaceholder;

            pageElement = <LiveData<IPageTemplateProps<TSlotType>>
                requiredAdapterTypes={pageCriticalAdapterTypes}
                asyncData={dataLoader.getData()}
                logger={this.props.logger}
                ContentComponent={contentComponentPromise}
                ErrorComponent={props => getErrorPlaceholder ? getErrorPlaceholder(props) :
                    this.props.renderErrorPlaceholder()}
                LoadingComponent={props => getLoadingPlaceholder ? getLoadingPlaceholder(props) :
                    this.props.renderLoadingPlaceholder()}
                contentProps={pageProps}
            />;
        } else {
            pageElement = <PageTemplate {...pageProps} />;
        }

        return <DataContext context={context} dataLoader={dataLoader}>
            <PageWrapper routeParams={context}
                hasSidebar={!!page.def.hasSidebar}
                sidebarMobileStore={this.sidebarMobileStore}
            >
                {pageElement}
            </PageWrapper>
        </DataContext>;
    }

    private renderContext<TParentContext, TChildContext>(
        contextConfig: IContext<TParentContext, TChildContext>,
        parentDataLoader: DataLoader<string, TParentContext>,
        parentContext: TParentContext,
        dataAdapters: MixedCollection<string, IDataAdapter<TChildContext, unknown>>,
        uiStateContainer: {}
    ) {
        let dataAdapterTypes = [
            ...this.collectDataAdapterTypes<TChildContext>({
                modules: contextConfig.children
            })
        ];
        let dataLoader = this.createDataLoader(contextConfig, dataAdapterTypes, dataAdapters);
        return <Observer>
            { () => {
                // Context create may use observable and we don't want to re-render the whole page so we
                // wrap the context in its own Observer
                let requiredAdapterTypes =
                    contextConfig.def.dataAdapters.filter(adapter => !adapter.optional).map(adapter => adapter.ref);
                if (requiredAdapterTypes.some(type => !parentDataLoader.getData().get(type)!.isLoaded())) {
                    return null;
                }
                const context = contextConfig.def.create(parentContext, parentDataLoader.getData());
                if (!context) {
                    return null;
                }
                return <DataContext context={context} dataLoader={dataLoader}>
                    {contextConfig.children.map((m, i) =>
                        this.renderChild<TChildContext>(m, i, dataLoader, context, uiStateContainer))}
                </DataContext>;
            } }
        </Observer>;
    }

    private isContext(child: any): child is IContext<any, any> {
        return !!(child as IContext<any, any>).def.create;
    }

    private isRefAdapterConfig(config: IDataAdapterConfig<any>): config is IDataAdapterRefConfig {
        return !!(config as IDataAdapterRefConfig).ref;
    }

    private renderChildren<
        TSlotType extends string | number,
        TContext,
        TChild extends IModule<any, TContext, any> | IContext<TContext, any>
    >(
        children: Record<TSlotType, TChild[]>,
        dataLoader: DataLoader<string, TContext>,
        context: TContext,
        uiStateContainer: {}
    ) {
        let renderedModules = Object.entries<TChild[]>(children).reduce((acc, [ slotType, modules ]) => {
            acc[slotType as TSlotType] = modules.map((mod, i) =>
                this.renderChild<TContext>(mod, i, dataLoader, context, uiStateContainer)
            );
            return acc;
        }, {} as Record<TSlotType, JSX.Element[]>);
        return renderedModules;
    }

    private renderChild<TContext>(
        child: IModule<any, TContext, any> | IContext<TContext, any>,
        index: number,
        dataLoader: DataLoader<string, TContext>,
        context: TContext,
        uiStateContainer: {}
    ) {
        return <ErrorBoundary errorEl={null} logger={this.props.logger} key={index}>
        { this.isContext(child) ?
            this.renderContext(child, dataLoader, context, dataLoader.dataAdapters, uiStateContainer) :
            this.renderModule(child, dataLoader, uiStateContainer, context) }
        </ErrorBoundary>;
    }

    private renderModule<TContentProps, TContext>(
        m: IModule<TContentProps, TContext, any>,
        dataLoader: DataLoader<string, TContext>,
        uiStateContainer: {},
        context: TContext
    ) {
        let children = m.children ?
            this.renderChildren(m.children, dataLoader, context, uiStateContainer) : void 0;

        let contentComponentPromise = m.def.getContentComponent().then(C => observer(
            (liveProps: IContentProps<TContext, any> & ILiveContentProps) =>
                <C {...m.def.getContentProps(liveProps)} />
        ));

        const getErrorPlaceholder = m.def.getErrorPlaceholder;
        const getLoadingPlaceholder = m.def.getLoadingPlaceholder;

        let requiredAdapterTypes = m.def.dataAdapters
            .filter(adapter => !adapter.optional)
            .map(adapter => this.isRefAdapterConfig(adapter) ? adapter.ref : adapter.alias) || [];

        return <LiveData<IContentProps<TContext, any>>
            requiredAdapterTypes={requiredAdapterTypes}
            asyncData={mapModuleData(m.def.dataAdapters, dataLoader, m.uuid)}
            logger={this.props.logger}
            ContentComponent={contentComponentPromise}
            ErrorComponent={getErrorPlaceholder ? props => getErrorPlaceholder(props) : void 0}
            LoadingComponent={getLoadingPlaceholder ? props => getLoadingPlaceholder(props) : void 0}
            contentProps={{
                locale: this.props.locale,
                translation: this.translationStore.getTranslations(m.pluginUri),
                logger: this.props.logger,
                sidebarVisible: this.sidebarMobileStore.isSidebarVisible,
                uiStateContainer,
                slots: children,
                context,
                options: m.options
            }}
        />;
    }
}
