
export interface ParseResult<T = any> {
    /**
     * the extracted information from resource
     */
    parsedObject?: T;
    links?: string[];
}

export abstract class VOParser<T = any> {

    abstract accept(uri: string): Promise<boolean>;

    abstract parse(blob: Buffer): Promise<ParseResult<T>>;

}


