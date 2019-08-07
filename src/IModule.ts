import { IModuleDef } from "plugin-api/IModuleDef";
import { IPage } from "./IPage";
import { IContext } from "./IContext";

export interface IModule<TContentProps, TContext, TSlotType = undefined> {
    pluginUri: string;
    uri: string;
    uuid: string;
    def: IModuleDef<TContentProps, TContext, TSlotType>;
    pageCritical?: boolean;
    options?: unknown;
    parent?: IPage<any, unknown> | IModule<unknown, unknown> | IContext<unknown, unknown>;
    children?: TSlotType extends string | number ?
        Record<TSlotType, IModule<any, TContext, any>[]> :
        undefined;
}
