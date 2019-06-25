import { IModule } from "./IModule";
import { IContext } from "./IContext";
import { IPageDef } from "plugin-api/IPageDef";

export interface IPage<TSlotType extends string | number, TContext> {
    pluginUri: string;
    uri: string;
    def: IPageDef<TSlotType, TContext>;
    uiStateContainer: {};
    options?: unknown;
    children: Record<TSlotType, (IModule<any, TContext, any> | IContext<TContext, any>)[]>;
}
