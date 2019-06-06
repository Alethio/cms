import { IPageConfigNode } from "./PageStructureReader";

export interface IConfigData {
    /** Where to load plugins from */
    pluginsBaseUrl: string;
    /** Map of pluginUri => config object */
    plugins: Record<string, unknown>;
    /** A tree structure describing which pages are available, with child modules */
    pages: IPageConfigNode[];
    /** Modules that are rendered directly in the root component (passed as Cms children prop) */
    rootModules: Record<string, IPageConfigNode[]>;
}

export class CmsConfig {
    private data: IConfigData;

    fromJson(data: IConfigData) {
        this.data = data;
        return this;
    }

    getPluginsBaseUrl() {
        return this.data.pluginsBaseUrl;
    }

    getPluginConfig(pluginUri: string) {
        if (!this.data.plugins[pluginUri]) {
            throw new Error(`Missing plugin config "${pluginUri}"`);
        }
        return this.data.plugins[pluginUri];
    }

    getPluginUris() {
        return Object.keys(this.data.plugins);
    }

    getPages() {
        return this.data.pages;
    }

    getRootModules() {
        return this.data.rootModules;
    }
}
