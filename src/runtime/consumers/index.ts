import { VOConsumer, ConsumerAcceptOptions } from "./VOConsumer";
import { Content } from "../models";

export * from "./VOConsumer";

export const createTypedVOConsumer = <T>(type: string, consumer: (content: Content<T>) => Promise<void>): VOConsumer<T> => {

    return new class extends VOConsumer {

        async accept(options: ConsumerAcceptOptions): Promise<boolean> {
            return options.type == type;
        }

        async consume(content: Content<T>): Promise<void> {
            return consumer(content);
        }


    };

};