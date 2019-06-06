import { InternalUrlResolver } from "./InternalUrlResolver";
import { History } from "history";

export class InternalNav {
    constructor(private internalUriResolver: InternalUrlResolver, private history: History) {

    }

    /** Returns true if the pageUri was resolved and the navigation was successful, or false otherwise */
    goTo(pageUri: string) {
        let resolvedUrl = this.internalUriResolver.resolve(pageUri);
        if (resolvedUrl) {
            this.history.push(resolvedUrl);
        }

        return !!resolvedUrl;
    }

    /** Resolves a page URI to a real URL */
    resolve(pageUri: string) {
        return this.internalUriResolver.resolve(pageUri);
    }
}
