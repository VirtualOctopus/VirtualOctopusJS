import { VOParser } from './VOParser';
import got, { Got } from 'got/dist/source';
import { Logger, getLogger } from 'log4js';


export interface AbstractTikaParserOpt {
  /**
   * server url, like http://127.0.0.1:9998
   */
  server: string;
}

const DefaultTikaOpt = {
  server: "http://127.0.0.1:9998"
};

/**
 * AbstractTikaParser
 * 
 * server documentation https://cwiki.apache.org/confluence/display/TIKA/TikaServer
 */
export abstract class AbstractTikaParser<T = any> extends VOParser<T> {

  constructor(opt: AbstractTikaParserOpt) {
    super();
    const _opt = Object.assign(DefaultTikaOpt, opt); // merge default data
    this._client = got.extend({ prefixUrl: _opt.server });
    this._logger = getLogger("AbstractTikaParser");
  }

  private _logger: Logger

  private _client: Got

  private async checkStatus(): Promise<boolean> {
    const response = await this._client("/tika");
    if (response && response.statusCode == 200) {
      return true;
    }
    return false;
  }



}
