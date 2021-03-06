import { LoadStatus } from "./LoadStatus";
import { observable, action } from "mobx";
import { IAsyncData, ILoadedAsyncData } from "plugin-api/IAsyncData";

export class AsyncData<T> implements IAsyncData<T> {
    @observable.ref
    data: T | undefined;
    @observable
    loadStatus = LoadStatus.Loading;

    constructor(data?: T) {
        this.data = data;
    }

    isLoaded(): this is ILoadedAsyncData<T> {
        return this.loadStatus === LoadStatus.Loaded;
    }

    isLoading() {
        return this.loadStatus === LoadStatus.Loading;
    }

    @action
    update(data: T | undefined) {
        this.data = data;
        this.loadStatus = data ? LoadStatus.Loaded : LoadStatus.Error;
    }

    @action
    reset() {
        this.data = void 0;
        this.loadStatus = LoadStatus.Loading;
    }
}
