import * as semver from "semver";
import { ILogger, IPlugin, IPluginManifest } from "plugin-api";
import { MixedCollection } from "./MixedCollection";
import { EntityCollection, EntityType } from "./EntityCollection";
import { PluginApiRuntime } from "./PluginApiRuntime";
import { PageStructureReader } from "./PageStructureReader";
import { PluginLoader } from "./PluginLoader";
import { CmsConfig } from "./CmsConfig";
import { ICmsRendererConfig } from "./component/ICmsRendererConfig";
import { PluginUrlBuilder } from "./PluginUrlBuilder";
import { PluginValidator } from "./PluginValidator";
import { IInlinePlugin } from "./IInlinePlugin";
import { PageStructureValidator } from "./PageStructureValidator";
import { version as cmsVersion } from "./version";
import { IPluginConfigMeta } from "./IPluginConfigMeta";
import { CancellationTokenSource } from "@puzzl/core/lib/async/cancellation";

export class PluginManager {
    constructor(
        private logger: ILogger,
        private config: CmsConfig,
        private inlinePlugins?: Map<string, () => Promise<IInlinePlugin>>
    ) {

    }

    async loadPlugins() {
        let plugins = new MixedCollection<string, IPlugin>();
        let entitiesByPlugin = new Map<string, EntityCollection>();
        let allEntities = new EntityCollection();
        let pageEntityOwnerPlugins = new Map<EntityType, string>();
        let pluginConfigMetas = new MixedCollection<string, IPluginConfigMeta<unknown>>();

        new PluginApiRuntime().init(window);

        for (let pluginUri of this.config.getPluginUris()) {
            try {
                let pluginConfigMeta = this.config.getPluginConfigMeta(pluginUri);

                let pluginConfig = pluginConfigMeta.config || {};
                let pluginVersion = new URL(pluginUri).searchParams.get("v") || void 0;
                this.logger.info(`Loading plugin ${pluginUri}...`);
                pluginUri = pluginUri.split("?")[0];

                // Index config metas by pluginUri (without query string)
                pluginConfigMetas.add(pluginUri, pluginConfigMeta);

                let pluginEntities = new EntityCollection();

                let plugin: IPlugin;
                if (this.inlinePlugins && this.inlinePlugins.has(pluginUri) && pluginUri.match(/^inline-plugin:\/\//)) {
                    let inlinePlugin = await this.inlinePlugins.get(pluginUri)!();
                    inlinePlugin.init(pluginConfig, pluginEntities, this.logger);
                    plugin = inlinePlugin;
                } else {
                    let pluginUrlBuilder = new PluginUrlBuilder(this.config.getPluginsBaseUrl());
                    let pluginModule = await new PluginLoader(pluginUrlBuilder).load(pluginUri, pluginVersion);
                    this.checkPluginManifest(pluginUri, pluginModule.manifest);
                    plugin = pluginModule.plugin;
                    let pluginPublicPath = pluginUrlBuilder.build(pluginUri, pluginVersion) + "/";
                    plugin.init(pluginConfig, pluginEntities, this.logger, pluginPublicPath);
                }

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
            allEntities.getPageEntities(), new PageStructureValidator(), pageEntityOwnerPlugins, this.logger
        );

        let rootModules = pageStructureReader.readModuleMap(this.config.getRootModules());
        let pages = pageStructureReader.read(pagesConfig);
        let dataAdapters = allEntities.getDataAdapters();

        this.logger.info("Loading data sources...");
        await Promise.all([...allEntities.getDataSources().entries()].map(async ([uri, dataSource]) => {
            // Build a map of adapter dependencies data to be made available to each data source during initialization
            // The adapters should be simple and not depend on and data source being already initialized
            // TODO: Load the dataSources using a dependency graph (see DataLoader) and allow any data adapter deps
            let adapterDepData = new Map<string, unknown>();

            if (dataSource.dependencies?.length) {
                await Promise.all(dataSource.dependencies.map(async dep => {
                    if (!dataAdapters.has(dep.ref)) {
                        if (dep.optional) {
                            adapterDepData.set(dep.ref, void 0);
                        }
                        throw new Error(`Data source "${uri}" depends on a non-existing data adapter (${dep.ref})`);
                    }
                    let adapter = dataAdapters.get(dep.ref);
                    if (JSON.stringify(adapter.contextType) !== "{}") {
                        throw new Error(`Data source "${uri}" depends on an adapter with a non-root contextType` +
                            `(adapterUri = "${dep.ref}", expected contextType={}, actual=${adapter.contextType})`);
                    }
                    if (adapter.dependencies?.length) {
                        throw new Error(`Failed to load data source "${uri}". ` +
                            `Adapter dependency ${dep.ref} must refer to a simple adapter, with no dependencies`);
                    }
                    let data = await adapter.load({}, new CancellationTokenSource().token, new Map());
                    adapterDepData.set(dep.ref, data);
                    if (dep.alias) {
                        adapterDepData.set(dep.alias, data);
                    }
                }));
            }

            await dataSource.init(adapterDepData);
        }));
        this.logger.info("Data sources loaded.");

        let cmsRendererConfig: ICmsRendererConfig = {
            plugins,
            pluginConfigMetas,
            pages,
            dataAdapters,
            rootModules
        };

        return cmsRendererConfig;
    }

    private checkPluginManifest(pluginUri: string, manifest: IPluginManifest | undefined) {
        if (!manifest) {
            this.logger.warn(`Legacy plugin detected. Plugin "${pluginUri}" doesn't have a manifest. ` +
                `\nMost likely the plugin was generated with an outdated cms-plugin-tool. ` +
                `\n\nTo remove this warning, please migrate the plugin to the new format, ` +
                `by applying the changes at https://github.com/Alethio/cms-plugin-tool/pull/8/files`);
            return;
        }
        if (manifest.cmsVersion) {
            if (!semver.validRange(manifest.cmsVersion)) {
                this.logger.error(`Invalid manifest for plugin "${pluginUri}". ` +
                    `"${manifest.cmsVersion}" is not a valid semver range.`);
            } else if (!semver.satisfies(cmsVersion, manifest.cmsVersion)) {
                this.logger.error(`Plugin "${pluginUri}" requires a different Alethio CMS version ` +
                    `(expected = "${manifest.cmsVersion}"; actual = "${cmsVersion}").` +
                    `\n\nWe will attempt to load the plugin now, but it may not work correctly.`);
            }
        }
    }
}
