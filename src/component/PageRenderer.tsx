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
import { HelpMode } from "./HelpMode";
import { observable } from "mobx";
import { IHelpComponentProps } from "./IHelpComponentProps";
import { ModuleContainer } from "./ModuleContainer";
import { ModuleFrame } from "./ModuleFrame";
import { IPluginConfigMeta } from "../IPluginConfigMeta";

export interface IRootPageProps<TSlotType extends string | number> {
    /** Placeholder where the CMS renders the routes (pages) */
    routes: JSX.Element;
    /** The state of the mobile sidebar */
    sidebarMobileStore: SidebarMobileStore;
    /** Placeholders for other modules that are placed at the root of the page */
    slots?: Record<TSlotType, JSX.Element[]>;
    helpMode: HelpMode;
}

export interface IPageRendererProps<TRootSlotType extends string | number> {
    plugins: MixedCollection<string, IPlugin>;
    pluginConfigMetas: MixedCollection<string, IPluginConfigMeta<unknown>>;
    dataAdapters: MixedCollection<string, IDataAdapter<unknown, unknown>>;
    pages: IPage<any, any>[];
    rootModules: Record<TRootSlotType, IModule<any, {}>[]>;
    logger: ILogger;
    locale: string;
    defaultLocale: string;
    basePath?: string;
    HelpComponent?: React.ComponentType<IHelpComponentProps>;
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
    private dataLoaders = new Map<IContext<any, any> | IPage<any, any> | string, DataLoader<unknown>>();

    private linkContext: ILinkContext;
    private rootContext = {};
    private toolbarUiState = {};
    private helpMode: HelpMode;
    @observable.ref
    private helpOpenFor: IModule<any, any> | undefined;

    constructor(props: IPageRendererProps<TRootSlotType>) {
        super(props);

        this.sidebarMobileStore = new SidebarMobileStore();
        this.helpMode = new HelpMode();

        this.linkContext = {
            pages: this.props.pages
        };

        this.translationStore = new PluginTranslationStore(
            this.props.plugins,
            this.props.pluginConfigMetas,
            this.props.defaultLocale
        );

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

        let dataAdapterTypes = this.collectAdapterUris(rootModules);
        let dataLoader = this.createDataLoader("internal://root", dataAdapterTypes, this.props.dataAdapters);

        let slots = this.renderChildren(rootModules, dataLoader, context, uiStateContainer);

        return <LinkContext.Provider value={this.linkContext}>
            <BrowserRouter basename={this.props.basePath}>
                <DataContext context={context} dataLoader={dataLoader}>
                    { this.props.children({
                        routes: this.renderPages(),
                        slots,
                        sidebarMobileStore: this.sidebarMobileStore,
                        helpMode: this.helpMode
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
                        let dataAdapterUris = createContext.dataAdapters.map(adapter => adapter.ref);
                        let optionalAdapterUris = createContext.dataAdapters
                            .filter(adapter => !!adapter.optional)
                            .map(adapter => adapter.ref);
                        dataAdapterUris = this.filterMissingAdapters(dataAdapterUris, optionalAdapterUris);
                        let dataLoader = this.createDataLoader(
                            path, dataAdapterUris, this.props.dataAdapters);
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
            return this.dataLoaders.get(cacheKey)! as DataLoader<TContext>;
        }
        let dataLoader = new DataLoader<TContext>(
            dataAdapterTypes,
            dataAdapters,
            this.props.logger,
            isRoot
        );
        this.dataLoaders.set(cacheKey, dataLoader);
        return dataLoader;
    }

    /**
     * Gathers a list of data dependencies as adapter URIs by deeply walking the tree structure of the page
     *
     * For each context, data adapter URIs are grouped and deduped into a single flat array,
     * which will be passed to a DataLoader.
     * This is an optimization that ensures the same data is loaded only once, if required by more than one module
     *
     * Nested contexts are ignored, as they have their own DataLoader instances
     */
    private collectAdapterUris<TContext>(
        childrenMap: Record<any, (IModule<any, TContext, any> | IContext<TContext, any>)[]>
    ) {
        let dataAdapterUris = new Set<string>();
        // Keep track of which URI is required at least once. It can be assumed optional only if all usages are optional
        let requiredUris = new Set<string>();

        Object.values(childrenMap).forEach(children => {
            children.forEach(child => {
                let collected: { uri: string; optional: boolean }[];
                if (this.isContext(child)) {
                    collected = child.def.dataAdapters.map(adapter => ({
                        uri: adapter.ref,
                        optional: !!adapter.optional
                    }));
                } else {
                    collected = child.def.dataAdapters.map((adapter, i) => {
                        if (this.isRefAdapterConfig(adapter)) {
                            return { uri: adapter.ref, optional: !!adapter.optional };
                        } else {
                            let adapterName = `local-adapter://${child.uuid}/${i}`;
                            this.props.dataAdapters.add(adapterName, adapter.def);
                            return { uri: adapterName, optional: !!adapter.optional };
                        }
                    });
                }

                collected.forEach(({ uri, optional }) => {
                    dataAdapterUris.add(uri);
                    if (!optional) {
                        requiredUris.add(uri);
                    }
                });

                if (this.isContext(child) || !child.children) {
                    return;
                }
                this.collectAdapterUris<TContext>(child.children).forEach(uri => {
                    dataAdapterUris.add(uri);
                    // The nested call already filters out missing adapter URIs, so we can mark them as non-optional
                    // to avoid filtering them again, by falsly considering them optional, without throwing an error
                    requiredUris.add(uri);
                });
            });
        });

        let optionalAdapterUris = [...dataAdapterUris].filter(uri => !requiredUris.has(uri));
        return this.filterMissingAdapters([...dataAdapterUris], optionalAdapterUris);
    }

    /** From a list of adapter URIs, filters out adapters that are optional and not defined by any plugin */
    private filterMissingAdapters(adapterUris: string[], optionalAdapterUris: string[]) {
        return adapterUris.filter(adapterUri => {
            if (optionalAdapterUris.find(optionalUri => optionalUri === adapterUri) &&
                !this.props.dataAdapters.has(adapterUri)
            ) {
                return false;
            }
            return true;
        });
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
        let dataAdapterTypes = this.collectAdapterUris<TContext>(page.children);
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
        parentDataLoader: DataLoader<TParentContext>,
        parentContext: TParentContext,
        dataAdapters: MixedCollection<string, IDataAdapter<TChildContext, unknown>>,
        uiStateContainer: {}
    ) {
        let dataAdapterTypes = this.collectAdapterUris<TChildContext>({
            modules: contextConfig.children
        });
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

    private isModule(child: any): child is IModule<any, any> {
        return !!(child as IModule<any, any>).def.getContentComponent;
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
        dataLoader: DataLoader<TContext>,
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
        dataLoader: DataLoader<TContext>,
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
        dataLoader: DataLoader<TContext>,
        uiStateContainer: {},
        context: TContext
    ) {
        let children = m.children ?
            this.renderChildren(m.children, dataLoader, context, uiStateContainer) : void 0;

        let hasHelp = !!m.def.getHelpComponent;
        let { HelpComponent } = this.props;

        let contentComponentPromise = m.def.getContentComponent().then(C => observer(
            (liveProps: IContentProps<TContext, any> & ILiveContentProps) => <>
                { /* The container doesn't depend on observables, otherwise it would re-render the content as well */}
                <ModuleContainer style={m.def.getWrapperStyle ? m.def.getWrapperStyle(liveProps) : {}}>
                    { /* Using observer to prevent rerendering module content when help mode is switched on/off */}
                    <Observer>{() => this.helpMode.isActive() && !(!hasHelp && this.moduleHasAncestorWithHelp(m)) ?
                        <ModuleFrame
                            hasHelp={hasHelp}
                            onClick={hasHelp ? () => this.helpOpenFor = m : void 0}
                        /> : null
                    }</Observer>
                    <Observer>{() => <>
                        { this.helpMode.isActive() && this.helpOpenFor === m && HelpComponent ?
                        <HelpComponent module={m} onRequestClose={() => this.helpOpenFor = void 0}>
                            <LiveData<IContentProps<TContext, any>>
                                logger={this.props.logger}
                                ContentComponent={Promise.resolve(observer(
                                    m.def.getHelpComponent!() as React.ComponentType<any>
                                ))}
                                contentProps={liveProps}
                                requiredAdapterTypes={[]}
                                asyncData={new Map()}
                            />
                        </HelpComponent> : null }
                    </>}</Observer>
                    <C {...m.def.getContentProps(liveProps)} />
                </ModuleContainer>
            </>
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

    private moduleHasAncestorWithHelp(m: IModule<any, any>) {
        let currentNode: IModule<any, any> | IContext<any, any> = m;

        while (currentNode.parent) {
            if (this.isModule(currentNode.parent) && currentNode.parent.def.getHelpComponent) {
                return true;
            }
            currentNode = currentNode.parent as IModule<any, any> | IContext<any, any>;
        }

        return false;
    }
}
