import { Content } from "../models";
import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface ConsumerAcceptOptions {
  uri?: string;
  type?: string;
}
export enum ErrorPhase {
  SendRequest,
  ParseContent,
  ConsumeData,
  InternalUnknown,
}

export interface ErrorConsumerContext {
  uri?: string;
  type?: string;
  phase?: ErrorPhase;
}


export abstract class VOConsumer<T = any> extends VOPlugin {

  getKind(): PluginKind {
    return PluginKind.Consumer;
  }

  abstract accept(options: ConsumerAcceptOptions): Promise<boolean>;

  abstract consume(content: Content<T>): Promise<void>;

}

export abstract class VOErrorConsumer extends VOPlugin {

  getKind(): PluginKind {
    return PluginKind.ErrorConsumer;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async accept(options: ConsumerAcceptOptions): Promise<boolean> {
    return true;
  }

  /**
   * consumer errors
   * 
   * @param error 
   */
  abstract consume(error: Error, ctx: ErrorConsumerContext): Promise<void>;

}
