import { observable } from "mobx";

export class HelpMode {
    @observable
    private active = false;

    toggle() {
        this.active = !this.active;
    }

    isActive() {
        return this.active;
    }
}
