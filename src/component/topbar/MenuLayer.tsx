import * as React from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import { observer } from "mobx-react";
import { Fade } from "@alethio/ui/lib/fx/Fade";
import { Mask } from "@alethio/ui/lib/overlay/Mask";
import { CloseIcon } from "@alethio/ui/lib/icon/CloseIcon";
import { ToolbarIconButton } from "@alethio/ui/lib/layout/toolbar/ToolbarIconButton";
import { TopbarItem } from "@alethio/ui/lib/layout/topbar/TopbarItem";
import { MenuContext } from "./MenuContext";

const Layer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
`;

const Content = styled.div`
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
`;

export interface IMenuLayerProps {
    open: boolean;
    onRequestClose(): void;
}

/**
 * Mobile navigation menu. Can receive `MenuItem` components as children.
 */
@observer
export class MenuLayer extends React.Component<IMenuLayerProps> {
    render() {
        let { open } = this.props;

        return ( open ?
        ReactDOM.createPortal(<Fade duration={.2}>
            <Mask onClick={this.handleRootClick} />
            <Layer>
                <TopbarItem>
                    <ToolbarIconButton onClick={this.onClose} Icon={CloseIcon} iconSize={48} />
                </TopbarItem>
                <Content>
                    <MenuContext.Provider value={{ requestClose: this.onClose }}>
                        { this.props.children }
                    </MenuContext.Provider>
                </Content>
            </Layer>
        </Fade>, document.body)
        : null );
    }

    private handleRootClick = (e: React.MouseEvent<{}>) => {
        if (e.target === e.currentTarget) {
            this.onClose();
        }
    }

    private onClose = () => {
        this.props.onRequestClose();
    }

}
