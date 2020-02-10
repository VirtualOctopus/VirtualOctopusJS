import { Content } from "../models";
import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface ConsumerAcceptOptions {
    uri?: string;
    type?: string;
}


export abstract class VOConsumer<T = any> extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Consumer;
    }

    abstract async accept(options: ConsumerAcceptOptions): Promise<boolean>;

    abstract async consume(content: Content<T>): Promise<void>;

}

