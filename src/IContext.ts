import { IModule } from "./IModule";
import { IContextDef } from "plugin-api/IContextDef";
import { IPage } from "./IPage";

export interface IContext<TParentContext, TChildContext> {
    pluginUri: string;
    uri: string;
    def: IContextDef<TParentContext, TChildContext>;
    pageCritical?: boolean;
    parent?: IPage<any, unknown> | IModule<unknown, unknown> | IContext<unknown, unknown>;
    children: IModule<any, TChildContext, any>[];
}
