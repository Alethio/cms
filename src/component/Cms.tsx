import * as React from "react";
import { ICmsRendererConfig } from "./ICmsRendererConfig";
import { PluginManager } from "../PluginManager";
import { ILogger } from "plugin-api";
import { ITheme } from "@alethio/ui/lib/theme/ITheme";
import { CmsConfig } from "../CmsConfig";
import { IConfigData } from "../IConfigData";
import { LoadStatus } from "../LoadStatus";
import { observer } from "mobx-react";
import { observable } from "mobx";
import { PageRenderer, IRootPageProps } from "./PageRenderer";
import { ThemeContext } from "../ThemeContext";
import { ThemeProvider as StyledThemeProvider } from "@alethio/ui/lib/styled-components";

export interface ICmsProps<TRootSlotType extends string> {
    /** An object that will log errors and messages from the CMS (e.g. `logger={console}`) */
    logger: ILogger;
    config: IConfigData;
    /** If using styled-components, you can specify valid theme object, that will be passed down to each plugin */
    theme: ITheme;
    /** A locale string (e.g. en-US) that will be used for translation strings */
    locale: string;
    /** A fallback default locale for the plugins that don't support the currently selected locale */
    defaultLocale: string;
    children(props: IRootPageProps<TRootSlotType>): React.ReactNode;
    /** What should be rendered when a route doesn't exist */
    renderErrorPage(): React.ReactNode;
    /** Default error element to be rendered when there is an error in the top-level or page React component */
    renderErrorPlaceholder(): JSX.Element | null;
    /** Default loading indicator to be rendered while the CMS is loading */
    renderLoadingPlaceholder(): JSX.Element | null;
}

@observer
export class Cms<TRootSlotType extends string> extends React.Component<ICmsProps<TRootSlotType>> {
    @observable
    private loadStatus = LoadStatus.Loading;
    private cmsRendererConfig: ICmsRendererConfig;

    constructor(props: ICmsProps<TRootSlotType>) {
        super(props);

        let cmsConfig = new CmsConfig().fromJson(this.props.config);
        let pluginManager = new PluginManager(this.props.logger, cmsConfig);

        pluginManager.loadPlugins()
            .then(cmsRendererConfig => {
                this.cmsRendererConfig = cmsRendererConfig;
                this.loadStatus = LoadStatus.Loaded;
            })
            .catch(e => {
                this.props.logger.error(e);
                this.loadStatus = LoadStatus.Error;
            });
    }

    render() {
        return <ThemeContext.Provider value={this.props.theme}>
            <StyledThemeProvider theme={this.props.theme}>
                { this.renderPage() }
            </StyledThemeProvider>
        </ThemeContext.Provider>;
    }

    private renderPage() {
        if (this.loadStatus === LoadStatus.Error) {
            return this.props.renderErrorPlaceholder();
        }
        if (this.loadStatus === LoadStatus.Loading) {
            return this.props.renderLoadingPlaceholder();
        }

        let { dataAdapters, pages, plugins, rootModules } = this.cmsRendererConfig;

        return <PageRenderer
            dataAdapters={dataAdapters}
            pages={pages}
            plugins={plugins}
            rootModules={rootModules}
            logger={this.props.logger}
            locale={this.props.locale}
            defaultLocale={this.props.defaultLocale}
            basePath={this.props.config.basePath}
            renderErrorPage={this.props.renderErrorPage}
            renderErrorPlaceholder={this.props.renderErrorPlaceholder}
            renderLoadingPlaceholder={this.props.renderLoadingPlaceholder}
        >
            { this.props.children }
        </PageRenderer>;
    }
}
