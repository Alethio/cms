import { IReactionDisposer, autorun } from "mobx";
import { EventDispatcher, IEvent } from "@puzzl/core/lib/event/EventDispatcher";
import { IDataWatcher } from "plugin-api/IDataWatcher";

export class ObservableWatcher implements IDataWatcher {
    private refreshDisposer: IReactionDisposer | undefined;
    private lastEventTime: number | undefined;
    private dataRefreshEvent = new EventDispatcher<void, void>();

    constructor(private expression: () => any, private throttleSeconds = 0) {

    }

    get onData(): IEvent<void, void> {
        return this.dataRefreshEvent.asEvent();
    }

    watch() {
        this.refreshDisposer = autorun(() => {
            this.expression();
            if (this.throttleSeconds) {
                let now = Date.now();
                let prevTime = this.lastEventTime;

                if (prevTime && now - prevTime < 1000 * this.throttleSeconds) {
                    return;
                }
                this.lastEventTime = now;
            }
            this.dataRefreshEvent.dispatch(void 0, void 0);
        });
    }

    unwatch() {
        if (this.refreshDisposer) {
            this.refreshDisposer();
            this.refreshDisposer = void 0;
        }
    }
}
