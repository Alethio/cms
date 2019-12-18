import { MixedCollection } from "../MixedCollection";
import { IPlugin, IDataAdapter } from "plugin-api";
import { IPage } from "../IPage";
import { IModule } from "../IModule";
import { IPluginConfigMeta } from "../IPluginConfigMeta";

export interface ICmsRendererConfig {
    plugins: MixedCollection<string, IPlugin>;
    pluginConfigMetas: MixedCollection<string, IPluginConfigMeta<unknown>>;
    pages: IPage<any, any>[];
    dataAdapters: MixedCollection<string, IDataAdapter<unknown, unknown>>;
    rootModules: Record<string, IModule<any, {}>[]>;
}
