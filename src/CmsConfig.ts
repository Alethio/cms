import { IConfigData } from "./IConfigData";

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
        if (Array.isArray(this.data.plugins)) {
            let pluginConfigMeta = this.data.plugins.find(p => p.uri === pluginUri);
            if (!pluginConfigMeta) {
                throw new Error(`Missing plugin config "${pluginUri}"`);
            }
            return pluginConfigMeta.config || {};
        } else {
            // Legacy
            if (!this.data.plugins[pluginUri]) {
                throw new Error(`Missing plugin config "${pluginUri}"`);
            }
            return this.data.plugins[pluginUri];
        }
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
