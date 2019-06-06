import { observable, computed } from "mobx";

/**
 * HACK: This hack is needed to know whether there is a sidebar mounted in page.
 * If there is, on mobile top bar the sidebar icon is displayed
 */
export class SidebarMobileStore {
    @observable
    instancesCount = 0;

    /** If the mobile sidebar is toggled on from the topbar menu */
    @observable
    isSidebarOpen = false;

    /**
     * If the current page has a sidebar and the sidebar switch in the topbar is on
     *
     * Has no effect on desktop mode
     */
    @computed
    public get isSidebarVisible() {
        return this.isSidebarOpen && this.instancesCount > 0;
    }
}
