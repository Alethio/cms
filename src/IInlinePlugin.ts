import { IPlugin, IPluginApi, ILogger } from "plugin-api";

export interface IInlinePlugin extends IPlugin {
    init(config: any, api: IPluginApi, logger: ILogger): void;
}
