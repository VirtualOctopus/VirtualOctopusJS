import { ParseResult, ParserDefaultAcceptAllFunc } from './VOParser';
import HTTPTextParser from './HTTPTextParser';
import cheerio from "cheerio";


export interface CheerioParserExtractFunc<T> {
    ($: CheerioStatic): Promise<ParseResult<T>>;
}


export abstract class AbstractCheerIOParser<T = any> extends HTTPTextParser<T> {

    async parseText(html: string): Promise<ParseResult<T>> {
        const $ = cheerio.load(html);
        return this.extract($);
    }

    abstract extract($: CheerioStatic): Promise<ParseResult<T>>;

}

export const createCheerioParser = <T>(accept = ParserDefaultAcceptAllFunc, extract: CheerioParserExtractFunc<T>): AbstractCheerIOParser<T> => {
    return new class extends AbstractCheerIOParser {
        accept = accept
        extract = extract
    };
};
