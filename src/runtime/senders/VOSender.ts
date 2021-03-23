import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface RetrieveResponse {
  content?: Buffer;
  /**
   * mime type
   */
  type?: string;
}

export abstract class VOSender extends VOPlugin {

  getKind(): PluginKind {
    return PluginKind.Sender;
  }

  abstract accept(uri: string): Promise<boolean>;

  abstract retrieve(uri: string): Promise<RetrieveResponse>;

}