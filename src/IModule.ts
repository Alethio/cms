import { IModuleDef } from "plugin-api/IModuleDef";

export interface IModule<TContentProps, TContext, TSlotType = undefined> {
    pluginUri: string;
    uuid: string;
    def: IModuleDef<TContentProps, TContext, TSlotType>;
    pageCritical?: boolean;
    options?: unknown;
    children?: TSlotType extends string | number ?
        Record<TSlotType, IModule<any, TContext, any>[]> :
        undefined;
}
