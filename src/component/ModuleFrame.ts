import styled, { css } from "styled-components";
import { ModuleContainer } from "./ModuleContainer";

export interface IModuleFrameProps {
    hasHelp: boolean;
}

export const ModuleFrame = styled<IModuleFrameProps, "div">("div")`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100000;

    ${ModuleContainer}:hover > & {
        ${props => props.hasHelp ? css`
            cursor: help;
            border: 2px #d4deee dashed;
        ` : css`
            cursor: not-allowed;
        `}
    }
`;
