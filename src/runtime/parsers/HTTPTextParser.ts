
import { VOParser, ParseResult } from './VOParser';


export default abstract class HTTPTextParser<T = any> extends VOParser<T> {

  async parse(blob: Buffer): Promise<ParseResult<T>> {
    return this.parseText(blob.toString("utf-8"));
  }

  abstract parseText(html: string): Promise<ParseResult<T>>;

}
