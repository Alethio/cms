# Define inline plugins with dynamic imports

## Context and Problem Statement

Needed the ability to load baked-in plugins, to avoid generating an entire plugin boilerplate + separate repo just for overriding some existing behavior and/or adding fairly isolated features.

## Considered Options

We pass a new prop (`inlinePlugins`) to the `Cms` component, which is:
* **Option 1**: an object map of `pluginUri` keys to `IPlugin` object values
* **Option 2**: an object map of `pluginUri` keys to `() => Promise<IPlugin>` callbacks

## Decision Outcome

Chosen `Option 2`, because

* Plugins might make use of the `plugin-api` module, which is not directly available in the host app. The `plugin-api` is a faux module, which the CMS emulates via a dummy `window.require` function, before actually loading any plugin. Plugins use the `externals` option in their webpack configuration, which transforms all `plugin-api` imports to a CJS `require("plugin-api")`, calling our global `window.require` function. For this to work, our plugin code must be loaded AFTER the `require` function was defined, meaning it has to be loaded via a dynamic import (hence the `() => Promise<IPlugin>`).

* `Option 1` would only work by not using the `plugin-api` module at all, or if the plugin author would dynamically import it in place. That would be more prone to errors and would further complicate plugin logic.
