import React from "react";

export interface IMenuContext {
    requestClose(): void;
}

export const MenuContext = React.createContext<IMenuContext>(null!);
