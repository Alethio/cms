import { IPageConfigNode } from "./PageStructureReader";
import { IPluginConfigMeta } from "./IPluginConfigMeta";

export interface IConfigData {
    /**
     * The path where the app is deployed relative to the domain root (defaults to `/`)
     * e.g. `/path`
     */
    basePath?: string;
    /**
     * Where to load plugins from. It can be an absolute URL pointing to an external CDN or a root-relative URL.
     * e.g. `https://external.cdn.tld/plugins` or `/plugins`
     */
    pluginsBaseUrl: string;
    /**
     * Specifies which plugins will be loaded, together with their specific configuration.
     *
     * This is an array of objects, each containing at least an `uri` property.
     *
     * Depending on how plugins were installed (if we use an external plugin CDN/repository, or
     * if we used `acp install` without the `--dev` option),
     * the pluginUri can also contain a query string that specifies the version
     * that we want to load (e.g. `?v=1.0.0`).
     *
     * Legacy behavior (deprecated): This can be an object that maps pluginUri-s to plugin config objects.
     * If a plugin has no configuration, then just pass an empty object.
     */
    plugins: Record<string, unknown> | IPluginConfigMeta<unknown>[];
    /**
     * A tree structure describing which pages are available, together with their descendant modules
     * See `IPageConfigNode` for the format of each node.
     */
    pages: IPageConfigNode[];
    /**
     * Modules that are rendered directly in slots of the root component (the one which is passed to Cms component)
     */
    rootModules: Record<string, IPageConfigNode[]>;
}
