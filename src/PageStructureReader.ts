import * as uuid from "uuid/v4";
import { IPage } from "./IPage";
import { MixedCollection } from "./MixedCollection";
import { IPageDef } from "plugin-api/IPageDef";
import { IModuleDef } from "plugin-api/IModuleDef";
import { IContextDef } from "plugin-api/IContextDef";
import { IContext } from "./IContext";
import { IModule } from "./IModule";
import { EntityType } from "./EntityCollection";
import { ILogger } from "plugin-api/ILogger";
import { PageStructureValidator } from "./PageStructureValidator";

export interface IPageConfigNode {
    /** A page URI for root nodes; module or context URIs for children */
    def: string;
    /**
     * (Only for modules and contexts) Whether the module/context must be fully loaded before rendering the page at all.
     * Otherwise the loading placeholder is rendered instead
     */
    pageCritical?: boolean;
    /**
     * (Only for modules and pages) Allows passing configuration to a module/page instance.
     * This object is forwarded via props to the module/page component.
     */
    options?: unknown;
    /**
     * Child nodes.
     * For context nodes, this is a flat array;
     * for modules and pages it is a (placeholderName, node) map
     */
    children?: Record<string, IPageConfigNode[]> | IPageConfigNode[];
}

type DefType = IPageDef<any, any> | IModuleDef<any, any, any> | IContextDef<any, any>;

export class PageStructureReader {
    constructor(
        private defs: MixedCollection<string, DefType>,
        private validator: PageStructureValidator,
        private ownerPlugins: Map<EntityType, string>,
        private logger: ILogger
    ) {

    }

    read(pagesConfig: IPageConfigNode[]) {
        this.validator.validate(pagesConfig);
        return pagesConfig.map(pageConfig => this.readNode(pageConfig)).filter(p => !!p) as IPage<any, any>[];
    }

    readModuleMap(modules: Record<string, IPageConfigNode[]>) {
        this.validator.validateModuleMap(modules);
        return this.mapObjectKeys(modules, n => this.readNode(n)) as Record<string, IModule<any, any, any>[]>;
    }

    private readNode(node: IPageConfigNode, parent?: IPage<any, any> | IModule<any, any> | IContext<any, any>) {
        let type = node.def;
        let def: DefType;
        try {
            def = this.defs.get(type);
        } catch (e) {
            this.logger.error(`Entity "${type}" is not exposed by any plugin`);
            return void 0;
        }
        if (type.match(/^page:\/\//)) {
            let page: IPage<any, any> = {
                pluginUri: this.ownerPlugins.get(def)!,
                uri: type,
                def: def as IPageDef<any, any>,
                uiStateContainer: {},
                options: node.options,
                children: {}
            };

            page.children = this.mapObjectKeys(
                (node.children || {}) as Record<string, IPageConfigNode[]>,
                n => this.readNode(n, page)
            );

            return page;
        } else if (type.match(/^context:\/\//)) {
            let context: IContext<any, any> = {
                pluginUri: this.ownerPlugins.get(def)!,
                uri: type,
                def: def as IContextDef<any, any>,
                pageCritical: !!node.pageCritical,
                parent,
                children: []
            };

            context.children = (node.children as IPageConfigNode[]).map(n => this.readNode(n, context))
                .filter(n => !!n) as IModule<any, any>[];

            return context;
        } else if (type.match(/^module:\/\//)) {
            let m: IModule<any, any, any> = {
                pluginUri: this.ownerPlugins.get(def)!,
                uuid: uuid(),
                uri: type,
                def: def as IModuleDef<any, any>,
                pageCritical: !!node.pageCritical,
                options: node.options,
                parent
            };

            if (node.children) {
                m.children = this.mapObjectKeys(
                    node.children as Record<string, IPageConfigNode[]>,
                    n => this.readNode(n, m)
                );
            }

            return m;
        }
        throw new Error(`Unknown node type for def "${type}"`);
    }

    private mapObjectKeys(
        o: Record<string, IPageConfigNode[]>,
        readNode: (node: IPageConfigNode) => IPage<any, any> | IModule<any, any> | IContext<any, any> | undefined
    ) {
        return Object.keys(o).map<[string, any]>(slotType => ([
            slotType, o[slotType].map(readNode).filter(n => !!n)
        ])).reduce((record, entries) => {
            record[entries[0]] = entries[1];
            return record;
        }, {} as Record<string, any>);
    }
}
