import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface RetrieveResponse {
    content?: Buffer;
    type?: string;
}

export abstract class VOSender extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Sender;
    }

    abstract async accept(uri: string): Promise<boolean>;

    abstract async retrieve(uri: string): Promise<RetrieveResponse>;

}