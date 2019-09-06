import { AsyncData } from "./AsyncData";
import { IDataAdapterConfig, IDataAdapterInlineConfig, IDataAdapterRefConfig } from "plugin-api/IDataAdapterConfig";
import { DataLoader } from "./DataLoader";

export const mapModuleData = (
    adapterConfigs: IDataAdapterConfig<unknown>[],
    dataLoader: DataLoader<unknown>,
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

            let adapterConfig = adapterConfigs.find((c: IDataAdapterRefConfig) => !!c.ref && c.ref === adapterName);
            if (adapterConfig && adapterConfig.alias) {
                asyncData.set(adapterConfig.alias, data);
            }
        }
    });
    return asyncData;
};
