
export interface ParseResult {
    /**
     * the extracted information from resource
     */
    parsedObject: any;
    links: string[];
}

export abstract class VOParser {

    abstract accept(uri: string): Promise<boolean>;

    abstract parse(blob: Buffer): Promise<ParseResult>;

}


