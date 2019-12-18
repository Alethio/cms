import { IConfigData } from "./IConfigData";
import { IPluginConfigMeta } from "./IPluginConfigMeta";
import { ILogger } from "plugin-api";

export class CmsConfig {
    private data: IConfigData;

    constructor(private logger: ILogger) {

    }

    fromJson(data: IConfigData) {
        if (!Array.isArray(data.plugins)) {
            this.logger.warn(`Deprecation warning: The "plugins" key of the CMS config has a deprecated format.` +
                `\nTo migrate, replace the object map with an array of objects containing ` +
                `at least an "uri" and an optional "config" key.` +
                `\n\nExample: [{ "uri": "plugin://my/plugin", "config": {}]`);
        }

        this.data = data;
        return this;
    }

    getPluginsBaseUrl() {
        return this.data.pluginsBaseUrl;
    }

    getPluginConfigMeta(pluginUri: string) {
        if (Array.isArray(this.data.plugins)) {
            let pluginConfigMeta = this.data.plugins.find(p => p.uri === pluginUri);
            if (!pluginConfigMeta) {
                throw new Error(`Missing plugin config "${pluginUri}"`);
            }
            return pluginConfigMeta;
        } else {
            // Legacy
            if (!this.data.plugins[pluginUri]) {
                throw new Error(`Missing plugin config "${pluginUri}"`);
            }
            let configMeta: IPluginConfigMeta<unknown> = {
                uri: pluginUri,
                config: this.data.plugins[pluginUri]
            };
            return configMeta;
        }
    }

    getPluginUris() {
        if (Array.isArray(this.data.plugins)) {
            return this.data.plugins.map(plugin => plugin.uri);
        }
        // Legacy
        return Object.keys(this.data.plugins);
    }

    getPages() {
        return this.data.pages;
    }

    getRootModules() {
        return this.data.rootModules;
    }
}
