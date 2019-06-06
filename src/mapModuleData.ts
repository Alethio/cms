import { AsyncData } from "./AsyncData";
import { IDataAdapterConfig, IDataAdapterInlineConfig } from "plugin-api/IDataAdapterConfig";
import { DataLoader } from "./DataLoader";

export const mapModuleData = (
    adapterConfigs: IDataAdapterConfig<unknown>[],
    dataLoader: DataLoader<string, unknown>,
    localAdapterScope: string
) => {
    let asyncData = new Map<string, AsyncData<unknown>>();
    dataLoader.getData().forEach((data, adapterName) => {
        let match = adapterName.match(/^local-adapter:\/\/([^/]+)\/(\d+)$/);
        if (match) {
            if (match[1] === localAdapterScope) {
                asyncData.set(
                    (adapterConfigs[Number(match[2])] as IDataAdapterInlineConfig<unknown>).alias,
                    data);
            }
        } else {
            asyncData.set(adapterName, data);
        }
    });
    return asyncData;
};
