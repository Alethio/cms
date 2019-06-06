import { ITranslation, ITranslations, ITranslationParams } from "plugin-api/ITranslation";

/**
 * Translation service
 *
 * Simple wrapper over a map of translation keys to translation strings with optional placeholders
 */
export class Translation implements ITranslation {
    constructor(private translations: ITranslations) {
    }

    /**
     * Get a translation by key
     *
     * Example:
     * translation object: `{ "myKey": "This is an example with {one} placeholder" }`
     * code: `translation.get("myKey", { one: "1" })`
     *
     * @param key the translation key
     * @param params an object with string replacements
     */
    get(key: keyof ITranslations, params?: ITranslationParams) {
        let raw = this.translations[key];

        if (raw && params) {
            Object.keys(params).forEach(paramName => {
                raw = raw.replace(paramName, "" + params[paramName]);
            });
        }

        return raw || key;
    }
}
