import { VOSender, RetrieveResponse } from "./VOSender";
import { PooledVOSender } from "./PooledSender";
import got, { Options, Got } from "got";

/**
 * 
 * DefaultHTTPTextSender
 * 
 * Basic impl for text html
 * 
 */
export class DefaultBasicHTTPSender extends VOSender {

  /**
   * DefaultBasicHTTPSender
   * 
   * @param opt options of all http requests
   */
  constructor(opt: Options = {}) {
    super();
    this._client = got.extend(opt);
  }

  private _client: Got

  async accept(): Promise<boolean> {
    return true;
  }

  async retrieve(uri: string): Promise<RetrieveResponse> {
    const response = await this._client(uri);
    return { content: Buffer.from(response.body, "utf8"), type: response.headers["content-type"] };
  }

}

/**
 * DefaultPooledHTTPTextSender
 */
export class DefaultPooledBasicHTTPSender extends PooledVOSender {

  constructor(opt: Options = {}) {
    super();
    this._client = got.extend(opt);
  }

  private _client: Got

  async accept(uri: string): Promise<boolean> {
    return true;
  }

  async poolRetrieve(uri: string): Promise<RetrieveResponse> {
    const response = await this._client(uri);
    return { content: Buffer.from(response.body, "utf8"), type: response.headers["content-type"] };
  }

}


