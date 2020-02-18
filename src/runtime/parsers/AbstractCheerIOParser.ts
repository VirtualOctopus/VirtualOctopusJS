import { ParseResult } from './VOParser';
import HTTPTextParser from './HTTPTextParser';
import cheerio from "cheerio";

export default abstract class AbstractCheerIOParser<T = any> extends HTTPTextParser<T> {

    async parseText(html: string): Promise<ParseResult<T>> {
        const $ = cheerio.load(html);
        return this.extract($);
    }

    abstract extract($: CheerioStatic): Promise<ParseResult<T>>;

}