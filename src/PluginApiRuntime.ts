import * as React from "react";
import * as ReactDOM from "react-dom";
import * as mobxExports from "mobx";
import * as mobxReactExports from "mobx-react";
import * as styledComponentsExports from "styled-components";

import { InlineModule } from "./component/InlineModule";
import { Link } from "./component/Link";
import { ObservableWatcher } from "./watcher/ObservableWatcher";
import { EventWatcher } from "./watcher/EventWatcher";
import { ThemeContext } from "./ThemeContext";
import { withInternalNav } from "./withInternalNav";
import { LoadStatus } from "./LoadStatus";

export class PluginApiRuntime {
    init(window: Window) {
        let exportsMap: Record<string, unknown> = {
            "plugin-api/component/InlineModule": { InlineModule },
            "plugin-api/component/Link": { Link },
            "plugin-api/watcher/ObservableWatcher": { ObservableWatcher },
            "plugin-api/watcher/EventWatcher": { EventWatcher },
            "plugin-api/ThemeContext": { ThemeContext },
            "plugin-api/withInternalNav": { withInternalNav },
            "plugin-api/LoadStatus": { LoadStatus },
            "react": React,
            "react-dom": ReactDOM,
            "mobx": mobxExports,
            "mobx-react": mobxReactExports,
            "styled-components": styledComponentsExports
        };
        (window as any).require = (request: string) => {
            if (exportsMap[request]) {
                return exportsMap[request];
            }
            throw new Error(`Module "${request}" is not provided by the plugin API.`);
        };
    }
}
