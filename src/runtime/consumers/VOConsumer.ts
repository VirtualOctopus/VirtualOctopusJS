import { Content } from "../models";
import { VOPlugin, PluginKind } from "../base/VOPlugin";


export abstract class VOConsumer<T = any> extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Consumer;
    }

    abstract async accept(uri: string): Promise<boolean>;

    abstract async consume(content: Content<T>): Promise<void>;

}

