import * as React from "react";
import { HashLink as ReactRouterLink } from "react-router-hash-link";
import { ExternalLink } from "@alethio/ui/lib/control/ExternalLink";
import { LinkContext } from "./LinkContext";
import { InternalUrlResolver } from "../InternalUrlResolver";

export interface ILinkProps {
    to: string;
    className?: string;
}

/**
 * Component for internal and external linking
 *
 * Anything that looks like a page URI is considered an internal link and resolved to a corresponding page route.
 * Anything starting with http/https is considered an external link and is opened in a separate window.
 * Relative links are not allowed.
 *
 * Route parameters can be passed to internal routes as a query string.
 * Given the route `/internal-page/:someParam`, the URI `page://my/internal-page?someParam=2`
 * will map `someParam` to the corresponding route param.
 */
export class Link extends React.PureComponent<ILinkProps> {
    render() {
        let { to, className } = this.props;

        if (/^(http|https):\/\/.*$/.test(to)) {
            return <ExternalLink href={to} rel="noopener noreferrer">{ this.props.children }</ExternalLink>;
        }

        if (/^\/$/.test(to)) {
            return <ReactRouterLink style={{ textDecoration: "none", outline: "none"}} className={className} to={to}>
                { this.props.children }
            </ReactRouterLink>;
        }

        const pageUriMatch = to.match(/^page:\/\/[^?#]+/);
        if (pageUriMatch) {
            return <LinkContext.Consumer>{({ pages }) => {
                if (!pages) {
                    throw new Error(`Missing link context`);
                }
                let resolvedUrl = new InternalUrlResolver(pages).resolve(to);
                if (!resolvedUrl) {
                    return this.props.children;
                }

                return <ReactRouterLink
                    style={{ textDecoration: "none", outline: "none"}}
                    className={className}
                    to={resolvedUrl}
                >{this.props.children}</ReactRouterLink>;
            }}</LinkContext.Consumer>;
        }

        throw new Error(`Relative URLs are not supported`);
    }
}
