export class PluginUrlBuilder {
    constructor(private pluginsBaseUrl: string) {

    }

    build(pluginUri: string, version?: string) {
        let pluginPath = pluginUri.replace(/^plugin:\/\//, "") + (version ? "/" + version : "");
        return `${this.pluginsBaseUrl}/${pluginPath}`;
    }
}
