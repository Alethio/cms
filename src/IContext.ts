import { IModule } from "./IModule";
import { IContextDef } from "plugin-api/IContextDef";
export interface IContext<TParentContext, TChildContext> {
    pluginUri: string;
    def: IContextDef<TParentContext, TChildContext>;
    pageCritical?: boolean;
    children: IModule<any, TChildContext, any>[];
}
