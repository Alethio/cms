import * as React from "react";
import { DataLoader } from "../DataLoader";

interface IDataContextProps<TContext> {
    context: TContext;
    dataLoader: DataLoader<TContext>;
}

export class DataContext<TContext>
extends React.Component<IDataContextProps<TContext>, {}> {
    constructor(props: IDataContextProps<TContext>) {
        super(props);
    }

    componentDidMount() {
        this.props.dataLoader.load(this.props.context);
    }

    componentDidUpdate(prevProps: IDataContextProps<TContext>) {
        if (JSON.stringify(this.props.context) !== JSON.stringify(prevProps.context)) {
            this.props.dataLoader.load(this.props.context);
        }
    }

    componentWillUnmount() {
        this.props.dataLoader.dispose();
    }

    render() {
        return this.props.children;
    }
}
