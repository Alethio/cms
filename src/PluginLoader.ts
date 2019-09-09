import { IPlugin } from "plugin-api/IPlugin";
import { IPluginManifest } from "plugin-api/IPluginManifest";
import { ScriptLoader } from "@puzzl/browser/lib/network/ScriptLoader";
import { PluginUrlBuilder } from "./PluginUrlBuilder";
import { Task } from "@puzzl/core/lib/async/Task";
import { sleep } from "@puzzl/core/lib/async/sleep";
import { OperationCanceledError } from "@puzzl/core/lib/async/cancellation";

interface IPluginExports {
    default: IPlugin;
    manifest: IPluginManifest;
}

interface IPluginModule {
    plugin: IPlugin;
    manifest: IPluginManifest;
}

/**
 * See https://stackoverflow.com/questions/43163909/solution-load-independently-compiled-webpack-2-bundles-dynamically
 */
export class PluginLoader {
    constructor(private pluginUrlBuilder: PluginUrlBuilder) {

    }

    async load(pluginUri: string, version?: string) {
        return new Promise<IPluginModule>((resolve, reject) => {
            // Listen for errors in plugin code that won't be caught by script loader
            const onError: OnErrorEventHandlerNonNull = (ev: ErrorEvent) => reject(ev.error);
            window.addEventListener("error", onError, { once: true });

            // Once the script has loaded, the JSONP callback should execute. If it doesn't run in reasonable time,
            // that means it failed. We'll use this task as a timeout handler.
            let timeoutTask = new Task(async (cancelToken) => {
                await sleep(5000, cancelToken);
                throw new Error(`Plugin code didn't execute in the alotted time. ` +
                    `The JSONP callback (${this.getPluginId(pluginUri)}) was not called.`);
            });

            let mainCallback = ({ default: plugin, manifest }: IPluginExports ) => {
                timeoutTask.cancel();
                window.removeEventListener("error", onError);

                resolve({ plugin, manifest });
            };
            this.installMainCallback(pluginUri, mainCallback);

            let pluginBaseUrl = this.pluginUrlBuilder.build(pluginUri, version);
            new ScriptLoader(document).load(`${pluginBaseUrl}/index.js`, {
                attrs: { crossorigin: "anonymous" }
            }).then(() => {
                timeoutTask.start().catch(e => {
                    if (!(e instanceof OperationCanceledError)) {
                        reject(e);
                    }
                });
            }).catch(reject);
        });
    }

    private installMainCallback<T>(pluginUri: string, mainCallback: (exports: T) => void) {
        let pluginId = this.getPluginId(pluginUri);
        (window as any)[pluginId] = (exports: any) => {
            delete (window as any)[pluginId];
            mainCallback(exports);
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
