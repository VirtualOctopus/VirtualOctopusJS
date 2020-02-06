
import { VOParser, ParseResult } from './VOParser';


export default abstract class HTTPTextParser extends VOParser {

    async parse(blob: Buffer): Promise<ParseResult> {
        return this.parseText(blob.toString("utf-8"));
    }

    abstract async parseText(html: string): Promise<ParseResult>;

}