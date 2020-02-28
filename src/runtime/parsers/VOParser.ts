import { VOPlugin, PluginKind } from "../base/VOPlugin";
import { string } from "@oclif/command/lib/flags";

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

export const DefaultAcceptAllFunc: ParserAcceptFunc = async (): Promise<boolean> => true;

export const EmptyParserParseFunc: ParserParseFunc<any> = async (blob: Buffer): Promise<ParseResult<any>> => {
    return {};
};

export const createVOParser = <T>(accept: ParserAcceptFunc = DefaultAcceptAllFunc, parse: ParserParseFunc<T>, parentClass = VOParser): VOParser<T> => {
    return new class extends parentClass {
        accept = accept
        parse = parse
    };
};

export const createTypedVOParser = <T>(type: string, parse: ParserParseFunc<T>, parentClass = VOParser): VOParser<T> => {
    return createVOParser(async (opt: ParserAcceptOptions): Promise<boolean> => opt.type == type, parse, parentClass);
};
