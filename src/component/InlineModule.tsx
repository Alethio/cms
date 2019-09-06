import * as React from "react";
import { DataContext } from "./DataContext";
import { DataLoader } from "../DataLoader";
import { MixedCollection } from "../MixedCollection";
import { ILogger } from "plugin-api/ILogger";
import { IDataAdapter } from "plugin-api/IDataAdapter";
import { LiveData } from "./LiveData";
import { ILiveContentProps } from "./ILiveContentProps";
import { observer } from "mobx-react";
import { IModuleInlineDef } from "plugin-api/IModuleInlineDef";
import { mapModuleData } from "../mapModuleData";

export interface IInlineModuleProps<TContext, TContentProps, TExtraProps> {
    context: TContext;
    moduleDef: IModuleInlineDef<TContentProps, TContext, TExtraProps>;
    logger: ILogger;
    extraContentProps?: TExtraProps;
}

export class InlineModule<TContext, TContentProps, TExtraProps>
extends React.Component<IInlineModuleProps<TContext, TContentProps, TExtraProps>> {
    private dataLoader: DataLoader<TContext>;

    constructor(props: IInlineModuleProps<TContext, TContentProps, TExtraProps>) {
        super(props);

        this.createDataLoader(this.props.moduleDef);
    }

    componentDidUpdate(prevProps: IInlineModuleProps<TContext, TContentProps, TExtraProps>) {
        if (this.props.moduleDef !== prevProps.moduleDef) {
            this.createDataLoader(this.props.moduleDef);
        }
    }

    private createDataLoader(moduleDef: IModuleInlineDef<TContentProps, TContext>) {
        let dataAdapterTypes = moduleDef.dataAdapters.map(adapter => adapter.alias);
        let dataAdapterCollection = new MixedCollection<string, IDataAdapter<TContext, unknown>>();
        moduleDef.dataAdapters.forEach(adapter => dataAdapterCollection.add(adapter.alias, adapter.def));
        this.dataLoader = new DataLoader(dataAdapterTypes, dataAdapterCollection, this.props.logger);
    }

    render() {
        let contentComponentPromise = this.props.moduleDef.getContentComponent().then(C => observer(
            (liveProps: TExtraProps & ILiveContentProps) =>
                <C {...this.props.moduleDef.getContentProps(liveProps)} />
        ));

        const getErrorPlaceholder = this.props.moduleDef.getErrorPlaceholder;
        const getLoadingPlaceholder = this.props.moduleDef.getLoadingPlaceholder;

        let requiredAdapterTypes = this.props.moduleDef.dataAdapters
            .filter(adapter => !adapter.optional)
            .map(adapter => adapter.alias) || [];

        return <DataContext context={this.props.context} dataLoader={this.dataLoader}>
            <LiveData<TExtraProps>
                ContentComponent={contentComponentPromise}
                ErrorComponent={getErrorPlaceholder ? liveProps => getErrorPlaceholder(liveProps) : void 0}
                LoadingComponent={getLoadingPlaceholder ? liveProps => getLoadingPlaceholder(liveProps) : void 0}
                contentProps={this.props.extraContentProps || ({} as TExtraProps)}
                logger={this.props.logger}
                asyncData={mapModuleData(this.props.moduleDef.dataAdapters, this.dataLoader, "")}
                requiredAdapterTypes={requiredAdapterTypes}
            />
        </DataContext>;
    }
}
