import { VOPlugin, PluginKind } from "../base/VOPlugin";


export abstract class VOSender extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Sender;
    }

    abstract async accept(uri: string): Promise<boolean>;

    abstract async retrieve(uri: string): Promise<Buffer>;

}