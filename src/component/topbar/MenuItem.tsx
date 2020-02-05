import * as React from "react";
import styled from "styled-components";
import { ValueBox } from "@alethio/ui/lib/layout/content/box/ValueBox";
import { MenuContext } from "./MenuContext";

const MenuIconRoot = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;

    background-color: #FFF;
    border-radius: 50%;
    box-shadow: 0 24px 56px 0 rgba(39, 54, 86, 0.16);
    margin: 12px;
`;

const MenuItemRoot = styled.div`
    display: flex;
    align-items: center;
`;

type ChildrenFn = (requestClose: () => void) => React.ReactNode;

interface IMenuItemProps {
    title: string;
    children: React.ReactNode | ChildrenFn;
    sticky?: boolean;
}

/**
 * Component for mobile navigation bar menu items
 *
 * Depends on context created at runtime and cannot be extracted to @alethio/ui
 * (unless we port it to legacy context API, just like the Accordion component)
 */
export class MenuItem extends React.Component<IMenuItemProps> {
    render() {
        let { children } = this.props;

        return <MenuContext.Consumer>{({requestClose}) =>
            <MenuItemRoot>
                <MenuIconRoot onClick={!this.props.sticky ? requestClose : void 0 }>
                    { typeof children === "function" ? (children as ChildrenFn)(requestClose) : children}
                </MenuIconRoot>
                <ValueBox>{this.props.title}</ValueBox>
            </MenuItemRoot>
        }</MenuContext.Consumer>;
    }
}
