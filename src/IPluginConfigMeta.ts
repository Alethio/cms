/**
 * Plugin config meta definition
 *
 * Wrapper for plugin config, allowing to specify configuration keys that are not intrinsic to the plugin itself,
 * but which are needed to configure the plugin instance within the CMS
 * (e.g. override translations, alias entities etc.)
 */
export interface IPluginConfigMeta<T> {
    /** URI for given plugin (e.g. plugin://publisher/name?v=1.0.0) */
    uri: string;
    /** Configuration object for given plugin */
    config?: T;
    /**
     * Translation overrides, per locale
     *
     * Example:
     * ```json
     * {
     *      "en-US": {
     *          "myKey": "Translation string"
     *      }
     * }
     * ```
     */
    translations?: Record<string, Record<string, string>>;
}
