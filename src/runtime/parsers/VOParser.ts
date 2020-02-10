import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface ParserAcceptOptions {
    uri?: string;
    type?: string;
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


