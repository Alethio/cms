import { ILogger, IPlugin } from "plugin-api";
import { MixedCollection } from "./MixedCollection";
import { EntityCollection, EntityType } from "./EntityCollection";
import { PluginApiRuntime } from "./PluginApiRuntime";
import { PageStructureReader } from "./PageStructureReader";
import { PluginLoader } from "./PluginLoader";
import { CmsConfig } from "./CmsConfig";
import { ICmsRendererConfig } from "./component/ICmsRendererConfig";
import { PluginUrlBuilder } from "./PluginUrlBuilder";
import { PluginValidator } from "./PluginValidator";

export class PluginManager {
    constructor(
        private logger: ILogger,
        private config: CmsConfig
    ) {

    }

    async loadPlugins() {
        let plugins = new MixedCollection<string, IPlugin>();
        let entitiesByPlugin = new Map<string, EntityCollection>();
        let allEntities = new EntityCollection();
        let pageEntityOwnerPlugins = new Map<EntityType, string>();

        new PluginApiRuntime().init(window);

        for (let pluginUri of this.config.getPluginUris()) {
            try {
                let pluginConfig = this.config.getPluginConfig(pluginUri);
                let pluginVersion = new URL(pluginUri).searchParams.get("v") || void 0;
                pluginUri = pluginUri.split("?")[0];
                this.logger.info(`Loading plugin ${pluginUri}...`);

                let pluginUrlBuilder = new PluginUrlBuilder(this.config.getPluginsBaseUrl());
                let plugin = await new PluginLoader(pluginUrlBuilder).load(pluginUri, pluginVersion);

                let pluginEntities = new EntityCollection();
                let pluginPublicPath = pluginUrlBuilder.build(pluginUri, pluginVersion) + "/";
                plugin.init(pluginConfig, pluginEntities, this.logger, pluginPublicPath);
                new PluginValidator().validate(plugin, pluginEntities);
                plugins.add(pluginUri, plugin);

                entitiesByPlugin.set(pluginUri, pluginEntities);
                allEntities.merge(pluginEntities);
                [...pluginEntities.getPageEntities().values()].forEach(v => pageEntityOwnerPlugins.set(v, pluginUri));
            } catch (e) {
                this.logger.error(`Failed loading plugin ${pluginUri}`, e);
            }
        }
        this.logger.info("Plugins loaded.");

        let pagesConfig = this.config.getPages();
        let pageStructureReader = new PageStructureReader(
            allEntities.getPageEntities(), pageEntityOwnerPlugins, this.logger
        );

        let rootModules = pageStructureReader.readModuleMap(this.config.getRootModules());
        let pages = pageStructureReader.read(pagesConfig);
        let dataAdapters = allEntities.getDataAdapters();

        this.logger.info("Loading data sources...");
        await Promise.all([...allEntities.getDataSources().values()].map(dataSource => dataSource.init()));
        this.logger.info("Data sources loaded.");

        let cmsRendererConfig: ICmsRendererConfig = {
            plugins,
            pages,
            dataAdapters,
            rootModules
        };

        return cmsRendererConfig;
    }
}