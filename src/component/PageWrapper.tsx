import * as React from "react";
import { SidebarMobileStore } from "../SidebarMobileStore";

interface IPageWrapperProps {
    routeParams: {};
    hasSidebar: boolean;
    sidebarMobileStore: SidebarMobileStore;
}

export class PageWrapper extends React.Component<IPageWrapperProps, {}> {
    componentDidMount() {
        this.props.sidebarMobileStore.instancesCount = this.props.hasSidebar ? 1 : 0;
    }

    componentDidUpdate(prevProps: IPageWrapperProps) {
        if (this.props.routeParams !== prevProps.routeParams) {
            window.scrollTo(0, 0);
            this.props.sidebarMobileStore.instancesCount = this.props.hasSidebar ? 1 : 0;
        }
    }

    componentWillUnmount() {
        this.props.sidebarMobileStore.instancesCount = 0;
    }

    render() {
        return this.props.children;
    }
}
