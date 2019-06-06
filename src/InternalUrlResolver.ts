import { IPage } from "./IPage";

export class InternalUrlResolver {
    constructor(private pages: IPage<any, any>[]) {

    }

    resolve(pageUri: string) {
        const pageUriMatch = pageUri.match(/^page:\/\/[^?#]+/);
        if (pageUriMatch) {
            const pages = this.pages;
            // We use the regular URL parser just to get the query string.
            // It's not otherwise reliable for generic URIs
            let uri = new URL(pageUri);
            let pageMeta = pages.find(p => p.uri === pageUriMatch[0]);
            if (!pageMeta || !pageMeta.def.buildCanonicalUrl) {
                return false;
            }
            let searchParams: any = {};
            uri.searchParams.forEach((v, k) => searchParams[k] = v);

            let resolvedUrl = pageMeta.def.buildCanonicalUrl(searchParams) + uri.hash;
            return resolvedUrl;
        } else {
            throw new Error(`URI "${pageUri}" doesn't look like a page:// URI`);
        }
    }
}
