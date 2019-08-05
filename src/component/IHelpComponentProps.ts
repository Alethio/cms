import { IModule } from "../IModule";

export interface IHelpComponentProps {
    module: IModule<any, any>;
    onRequestClose(): void;
}
