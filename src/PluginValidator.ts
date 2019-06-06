import {
    IPlugin, IPageDef, IContextDef, IModuleDef,
    IDataAdapterConfig, IDataAdapterRefConfig, IDataAdapterInlineConfig, IDataAdapter
} from "plugin-api";
import { EntityCollection } from "./EntityCollection";

export class PluginValidator {
    validate(plugin: IPlugin, entities: EntityCollection) {
        if (typeof plugin !== "object") {
            throw new Error(`Plugin must contain a single object as a default export`);
        }
        if (typeof plugin.init !== "function") {
            throw new Error(`Plugin must have an init() method`);
        }

        if (typeof plugin.getAvailableLocales === "function") {
            let locales = plugin.getAvailableLocales();
            if (locales.find(l => typeof l !== "string")) {
                throw new Error(`Plugin getAvailableLocales must return an array of strings`);
            }
            if (!plugin.loadTranslations) {
                throw new Error(`Plugin defines a list of locales, but no loadTranslations() method.`);
            }
        }

        for (let [uri, entity] of entities.getDataAdapters().entries()) {
            let [valid, err] = this.validateDataAdapterDef(entity);
            if (!valid) {
                throw new Error(`Data adapter "${uri}" is invalid. ${err}`);
            }
        }

        for (let [uri, entity] of entities.getDataSources().entries()) {
            if (typeof entity.init !== "function") {
                throw new Error(`Data source "${uri}" must have an init() method`);
            }
        }

        for (let [uri, entity] of entities.getPageEntities().entries()) {
            if (!this.validateContextType(entity.contextType)) {
                throw new Error(`Data adapter "${uri}" must have a valid contextType property`);
            }

            if (uri.match(/^page:/)) {
                let pageDef = entity as IPageDef<any, any>;
                if (typeof pageDef.paths !== "object") {
                    throw new Error(`Page "${uri}" must have a "paths" property`);
                }

                for (let [path, v] of Object.entries(pageDef.paths)) {
                    if (typeof v === "function") {
                        continue;
                    }

                    // If not a function, it can only be a context object
                    let [valid, err] = this.validateContextDef(v);
                    if (!valid) {
                        throw new Error(`Page "${uri}" doesn't have a valid paths map. ` +
                            `Path "${path}" doesn't have a valid context object. ${err}`);
                    }
                }

                if (typeof pageDef.getPageTemplate !== "function") {
                    throw new Error(`Page "${uri}" must have a getPageTemplate() method`);
                }
            } else if (uri.match(/^module:/)) {
                let moduleDef = entity as IModuleDef<any, any>;
                if (moduleDef.slotNames && moduleDef.slotNames.find(s => typeof s !== "string")) {
                    throw new Error(`Module "${uri}" doesn't have a valid "slotNames" property. ` +
                        `It must be an array of strings`);
                }
                let [valid, err] = this.validateDataAdapterConfigs(moduleDef.dataAdapters);
                if (!valid) {
                    throw new Error(`Module "${uri}" doesn't have a valid "dataAdapters" property. ${err}`);
                }
            } else if (uri.match(/^context:/)) {
                let contextDef = entity as IContextDef<any, any>;
                let [valid, err] = this.validateContextDef(contextDef);
                if (!valid) {
                    throw new Error(`Context "${uri}" is invalid. ${err}`);
                }
            } else {
                throw new Error(`Unknown entity type for entity "${uri}"`);
            }
        }
    }

    private validateContextDef(context: IContextDef<any, any>): [boolean, string?] {
        if (typeof context !== "object") {
            return [false, "Context is not an object"];
        }
        if (!this.validateContextType(context.contextType)) {
            return [false, "Invalid contextType"];
        }
        if (!this.validateContextType(context.parentContextType)) {
            return [false, "Invalid parentContextType"];
        }

        let [valid, err] = this.validateDataAdapterConfigs(context.dataAdapters, true);
        if (!valid) {
            return [false, `Invalid dataAdapters. ${err}`];
        }

        if (typeof context.create !== "function") {
            return [false, `Context must define a create() method`];
        }

        return [true];
    }

    private validateContextType(contextType: object) {
        if (typeof contextType !== "object" ||
            Object.values(contextType).find(v => typeof v !== "string" && typeof v !== "number")
        ) {
            return false;
        }
        return true;
    }

    private validateDataAdapterConfigs(
        configs: IDataAdapterConfig<any>[] | undefined, onlyRefs = false
    ): [boolean, string?] {
        if (!configs || !Array.isArray(configs)) {
            return [false, "dataAdapters must be an array."];
        }

        for (let config of configs) {
            if ((config as IDataAdapterRefConfig).ref) {
                if (typeof (config as IDataAdapterRefConfig).ref !== "string") {
                    return [false, `Data adapter "ref" property must be an URI string`];
                }
            } else {
                if (onlyRefs) {
                    return [false, `Data adapter config doesn't have a "ref" property`];
                }
                let [valid, err] = this.validateDataAdapterDef((config as IDataAdapterInlineConfig<any>).def);
                if (!valid) {
                    return [false, err];
                }
                if (!(config as IDataAdapterInlineConfig<any>).alias) {
                    return [false, `Inline data adapters must define an "alias" property`];
                }
            }
        }

        return [true];
    }

    private validateDataAdapterDef(dataAdapter: IDataAdapter<any, any> | undefined): [boolean, string?] {
        if (typeof dataAdapter !== "object") {
            return [false, "Data adapter must be an object"];
        }

        if (!this.validateContextType(dataAdapter.contextType)) {
            return [false, `Invalid contextType property`];
        }

        if (!dataAdapter.load) {
            return [false, `Data adapter must have a load() method`];
        }

        return [true];
    }
}
