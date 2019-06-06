import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { AsyncData } from "../AsyncData";
import { ErrorBoundary } from "@alethio/ui/lib/util/react/ErrorBoundary";
import { ILogger } from "plugin-api/ILogger";
import { ILiveContentProps } from "./ILiveContentProps";

type ReactComponentType<T> = React.ComponentClass<T> | React.StatelessComponent<T>;

interface ILiveDataProps<TContentProps> {
    logger: ILogger;
    ContentComponent: Promise<ReactComponentType<TContentProps & ILiveContentProps>>;
    contentProps: TContentProps;
    ErrorComponent?: ReactComponentType<TContentProps & ILiveContentProps>;
    LoadingComponent?: ReactComponentType<TContentProps & ILiveContentProps>;
    asyncData: Map<string, AsyncData<unknown>>;
    requiredAdapterTypes: string[];
}

@observer
export class LiveData<TContentProps> extends React.Component<ILiveDataProps<TContentProps>, {}> {
    @observable.ref
    private contentComponentBoxed: AsyncData<ReactComponentType<TContentProps & ILiveContentProps>>;

    constructor(props: ILiveDataProps<TContentProps>) {
        super(props);

        this.contentComponentBoxed = new AsyncData();
        this.props.ContentComponent.then(ContentComponent => {
            this.contentComponentBoxed.update(ContentComponent);
        }).catch(e => {
            this.props.logger.error("Couldn't load live data content component", e);
            this.contentComponentBoxed.update(void 0);
        });
    }

    render() {
        let asyncData = this.props.asyncData;
        let requiredData = this.props.requiredAdapterTypes
            .map(dataAdapterType => asyncData.get(dataAdapterType)!);

        let { LoadingComponent, ErrorComponent } = this.props;

        if (requiredData.some(data => data.isLoading()) || this.contentComponentBoxed.isLoading()) {
            return LoadingComponent ?
                <LoadingComponent asyncData={asyncData} {...this.props.contentProps} /> : null;
        }

        let errorBox = ErrorComponent ?
            <ErrorComponent asyncData={asyncData} {...this.props.contentProps} /> : null;

        if (requiredData.some(data => !data.isLoaded()) || !this.contentComponentBoxed.isLoaded()) {
            return errorBox;
        }

        let ContentComponent = this.contentComponentBoxed.data;

        return <ErrorBoundary errorEl={errorBox} logger={this.props.logger}>
            <ContentComponent asyncData={asyncData} {...this.props.contentProps} />
        </ErrorBoundary>;
    }
}
