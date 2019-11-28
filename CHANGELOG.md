# Unreleased

- Allow optional adapters dependencies in modules to not throw an error if the adapter is undefined.

# v1.0.0-beta.7

- Add plugin versioning and compatibility checks. This requires plugins to export a manifest object that contains some plugin metadata. Existing plugins can be manually migrated by replicating the changes in this PR: https://github.com/Alethio/cms-plugin-tool/pull/8/files. Plugins that have not been migrated, will show warnings in the developer console, but will continue to work correctly.
- Add support for data adapter dependencies

# v1.0.0-beta.6

- Better plugin error handling and add config validation
- Add alias support for data adapter config (ref variant)
- **Breaking change**: Modules are now wrapped with a `position: relative` container. Any module that had elements depending on the parent layout, such as flex or `height: 100%` could theoretically break. As a workaround, a new method called `getWrapperStyle` was added to the module definition.

# v1.0.0-beta.5

- Add support for inline (baked-in) plugins

# v1.0.0-beta.4

- Fix missing TypeScript export

# v1.0.0-beta.3

- Add support for sub-path routing for apps that are not deployed on the domain root

# v1.0.0-beta.2

- Add support for configuration options per module / per page

# v1.0.0-beta.1

- Dev tooling support: Add TypeScript declaration maps
