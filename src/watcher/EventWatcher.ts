import { IDataWatcher } from "plugin-api/IDataWatcher";
import { IEvent, EventDispatcher } from "@puzzl/core/lib/event/EventDispatcher";

export class EventWatcher<T> implements IDataWatcher {
    private _onData = new EventDispatcher<void, void>();

    get onData(): IEvent<void, void> {
        return this._onData.asEvent();
    }

    constructor(private event: IEvent<unknown, T>, private predicate: (evData: T) => boolean) {

    }

    watch() {
        this.event.subscribe(this.onEvent);
    }

    unwatch() {
        this.event.unsubscribe(this.onEvent);
    }

    private onEvent = (data: T) => {
        if (this.predicate(data)) {
            this._onData.dispatch();
        }
    }
}
