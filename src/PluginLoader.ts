import { IPlugin } from "plugin-api/IPlugin";
import { ScriptLoader } from "@puzzl/browser/lib/network/ScriptLoader";
import { PluginUrlBuilder } from "./PluginUrlBuilder";

/**
 * See https://stackoverflow.com/questions/43163909/solution-load-independently-compiled-webpack-2-bundles-dynamically
 */
export class PluginLoader {
    constructor(private pluginUrlBuilder: PluginUrlBuilder) {

    }

    async load(pluginUri: string, version?: string) {
        return new Promise<IPlugin>((resolve, reject) => {
            this.installMainCallback(pluginUri, resolve);
            let pluginBaseUrl = this.pluginUrlBuilder.build(pluginUri, version);
            new ScriptLoader(document).load(`${pluginBaseUrl}/index.js`).catch(reject);
        });
    }

    private installMainCallback<T>(pluginUri: string, mainCallback: (exports: T) => void) {
        let pluginId = this.getPluginId(pluginUri);
        (window as any)[pluginId] = (exports: any) => {
            delete (window as any)[pluginId];
            mainCallback(exports.__esModule ? exports.default : exports);
        };
    }

    private getPluginId(pluginUri: string) {
        return "__" + pluginUri
            .replace(/^plugin:\/\//, "")
            .replace(/\./g, "_")
            .replace(/\//g, "__")
            .replace(/-([a-z])/gi, (match, capture: string) => capture.toUpperCase());
    }
}
