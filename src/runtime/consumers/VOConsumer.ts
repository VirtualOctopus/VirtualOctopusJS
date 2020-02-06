import { Content } from "../models";


export abstract class VOConsumer<T = any> {

    abstract async accept(uri: string): Promise<boolean>;

    abstract async consume(content: Content<T>): Promise<void>;

}

