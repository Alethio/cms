import React from "react";
import { RouteComponentProps, withRouter } from "react-router";
import { LinkContext } from "./component/LinkContext";
import { InternalNav } from "./InternalNav";
import { InternalUrlResolver } from "./InternalUrlResolver";

interface IWrapperProps<P extends { internalNav?: InternalNav }> extends RouteComponentProps<never> {
    C: React.ComponentType<P>;
    childProps: P;
}

class Wrapper<P> extends React.Component<IWrapperProps<P>> {
    render() {
        let { C, childProps, history } = this.props;
        return <LinkContext.Consumer>{({ pages }) =>
            <C internalNav={new InternalNav(new InternalUrlResolver(pages), history)} {...childProps} />
        }</LinkContext.Consumer>;
    }
}

const WrapperWithRouter = withRouter(Wrapper);

/**
 * Higher-order component that exposes the `InternalNav` object as the prop `internalNav`. This allows access to the
 * internal URI resolver and redirect functionality.
 * @param C a React component class
 */
export const withInternalNav = <P extends { internalNav?: InternalNav }>(C: React.ComponentType<P>):
React.ComponentType<Pick<P, Exclude<keyof P, "internalNav">>> =>
    (props: P) => <WrapperWithRouter C={C} childProps={props} />;
