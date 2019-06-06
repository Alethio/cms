import React from "react";
import { IPage } from "../IPage";

export interface ILinkContext {
    pages: IPage<any, any>[];
}

export const LinkContext = React.createContext<ILinkContext>({} as ILinkContext);
