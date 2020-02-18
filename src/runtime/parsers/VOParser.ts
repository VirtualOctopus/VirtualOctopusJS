import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface ParserAcceptOptions {
    uri?: string;
    type?: string;
}

export interface ParserAcceptFunc {
    ({ uri, type }: ParserAcceptOptions): Promise<boolean>;
}

export interface ParserParseFunc<T> {
    (blob: Buffer): Promise<ParseResult<T>>;
}

export interface ParseResult<T = any> {
    /**
     * the extracted information from resource
     */
    parsedObject?: T;
    type?: string;
    links?: string[];
}

export abstract class VOParser<T = any> extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Parser;
    }

    abstract accept({ uri, type }: ParserAcceptOptions): Promise<boolean>;

    abstract parse(blob: Buffer): Promise<ParseResult<T>>;

}

export const createVOParser = <T>(accept: ParserAcceptFunc, parse: ParserParseFunc<T>, Clazz = VOParser): VOParser<T> => {
    return new class extends Clazz {
        accept = accept
        parse = parse
    };
};
