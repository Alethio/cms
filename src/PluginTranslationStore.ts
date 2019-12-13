import { observable } from "mobx";
import { MixedCollection } from "./MixedCollection";
import { IPlugin } from "plugin-api/IPlugin";
import { ITranslation } from "plugin-api/ITranslation";
import { Translation } from "./Translation";
import { IPluginConfigMeta } from "./IPluginConfigMeta";

export class PluginTranslationStore {
    @observable
    private translations: MixedCollection<string, ITranslation>;

    constructor(
        private plugins: MixedCollection<string, IPlugin>,
        private pluginConfigMetas: MixedCollection<string, IPluginConfigMeta<unknown>>,
        private defaultLocale: string
    ) {

    }

    async loadTranslations(locale: string) {
        let translations = new MixedCollection<string, ITranslation>();

        let translationsPromises = [...this.plugins.entries()]
            .map(([uri, plugin]) => {
                if (!plugin.getAvailableLocales || !plugin.loadTranslations) {
                    return Promise.resolve<[string, any]>([uri, {}]);
                }
                let pluginLocale = plugin.getAvailableLocales!().indexOf(locale) === -1 ? this.defaultLocale : locale;
                return plugin.loadTranslations!(pluginLocale).then<[string, any]>(data => ([uri, data]));
            });

        let loadedTranslations = await Promise.all(translationsPromises);
        loadedTranslations.forEach(([uri, translationJson]) => {
            translationJson = {
                ...translationJson,
                ...this.pluginConfigMetas.get(uri).translations?.[locale] ?? {}
            };
            translations.add(uri, new Translation(translationJson));
        });
        this.translations = translations;
    }

    isLoaded() {
        return !!this.translations;
    }

    getTranslations(pluginUri: string) {
        if (!pluginUri.match(/^(inline-)?plugin:\/\//)) {
            throw new Error(`Invalid plugin URI "${pluginUri}"`);
        }
        return this.translations && this.translations.get(pluginUri);
    }
}
