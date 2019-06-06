import { MixedCollection } from "./MixedCollection";
import { IDataSource } from "plugin-api/IDataSource";
import { IDataAdapter } from "plugin-api/IDataAdapter";
import { IPageDef } from "plugin-api/IPageDef";
import { IContextDef } from "plugin-api/IContextDef";
import { IModuleDef } from "plugin-api/IModuleDef";
import { IPluginApi } from "plugin-api/IPluginApi";

export type EntityType = IDataSource | IDataAdapter<any, any> | IPageDef<any, any> | IContextDef<any, any> |
    IModuleDef<any, any, any>;

export class EntityCollection implements IPluginApi {
    private allEntities = new MixedCollection<string, EntityType>();
    private dataSources = new MixedCollection<string, IDataSource>();
    private dataAdapters = new MixedCollection<string, IDataAdapter<any, any>>();
    private pageDefs = new MixedCollection<string, IPageDef<any, any>>();
    private moduleDefs = new MixedCollection<string, IModuleDef<any, any, any>>();
    private contextDefs = new MixedCollection<string, IContextDef<any, any>>();

    addDataSource(uri: string, dataSource: IDataSource) {
        if (!uri.match(/^source:\/\//)) {
            throw new Error(`Invalid data source URI "${uri}"`);
        }
        this.dataSources.add(uri, dataSource);
        this.allEntities.add(uri, dataSource);
    }

    addDataAdapter(uri: string, dataAdapter: IDataAdapter<any, any>) {
        if (!uri.match(/^adapter:\/\//)) {
            throw new Error(`Invalid data adapter URI "${uri}"`);
        }
        this.dataAdapters.add(uri, dataAdapter);
        this.allEntities.add(uri, dataAdapter);
    }

    addPageDef(uri: string, pageDef: IPageDef<any, any>) {
        if (!uri.match(/^page:\/\//)) {
            throw new Error(`Invalid page def URI "${uri}"`);
        }
        this.pageDefs.add(uri, pageDef);
        this.allEntities.add(uri, pageDef);
    }

    addModuleDef(uri: string, moduleDef: IModuleDef<any, any, any>) {
        if (!uri.match(/^module:\/\//)) {
            throw new Error(`Invalid module def URI "${uri}"`);
        }
        this.moduleDefs.add(uri, moduleDef);
        this.allEntities.add(uri, moduleDef);
    }

    addContextDef(uri: string, contextDef: IContextDef<any, any>) {
        if (!uri.match(/^context:\/\//)) {
            throw new Error(`Invalid context def URI "${uri}"`);
        }
        this.contextDefs.add(uri, contextDef);
        this.allEntities.add(uri, contextDef);
    }

    getDataSources() {
        return this.dataSources;
    }

    getDataAdapters() {
        return this.dataAdapters;
    }

    getPageEntities() {
        return new MixedCollection<string, IPageDef<any, any> | IModuleDef<any, any, any> | IContextDef<any, any>>()
            .merge(this.pageDefs)
            .merge(this.contextDefs)
            .merge(this.moduleDefs);
    }

    get<T extends EntityType>(uri: string) {
        return this.allEntities.get<T>(uri);
    }

    merge(e: this) {
        [...e.dataAdapters.entries()].forEach(([uri, dataAdapter]) => this.addDataAdapter(uri, dataAdapter));
        [...e.dataSources.entries()].forEach(([uri, dataSource]) => this.addDataSource(uri, dataSource));
        [...e.pageDefs.entries()].forEach(([uri, pageDef]) => this.addPageDef(uri, pageDef));
        [...e.moduleDefs.entries()].forEach(([uri, moduleDef]) => this.addModuleDef(uri, moduleDef));
        [...e.contextDefs.entries()].forEach(([uri, contextDef]) => this.addContextDef(uri, contextDef));
    }
}
