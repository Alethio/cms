import React, { AnchorHTMLAttributes } from "react";
import styled from "@alethio/ui/lib/styled-components";

const ExternalLinkRoot = styled.a`
    text-decoration: none;
    outline: none;
    color: ${props => props.theme.colors.link};
`;

/**
 * Link that is opened in a separate window
 */
export class ExternalLink extends React.Component<AnchorHTMLAttributes<HTMLAnchorElement>> {
    render() {
        return <ExternalLinkRoot target="_blank" {...this.props}>{this.props.children}</ExternalLinkRoot>;
    }
}
