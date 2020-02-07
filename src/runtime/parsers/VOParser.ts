import { VOPlugin, PluginKind } from "../base/VOPlugin";

export interface ParseResult<T = any> {
    /**
     * the extracted information from resource
     */
    parsedObject?: T;
    links?: string[];
}

export abstract class VOParser<T = any> extends VOPlugin {

    getKind(): PluginKind {
        return PluginKind.Parser;
    }

    abstract accept(uri: string): Promise<boolean>;

    abstract parse(blob: Buffer): Promise<ParseResult<T>>;

}


