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

export const ParserDefaultAcceptAllFunc: ParserAcceptFunc = async (): Promise<boolean> => true;

export const ParserDefaultEmptyParseFunc: ParserParseFunc<any> = async (): Promise<ParseResult<any>> => {
  return {};
};

export const createVOParser = <T>(accept: ParserAcceptFunc = ParserDefaultAcceptAllFunc, parse: ParserParseFunc<T>, parentClass = VOParser): VOParser<T> => {
  return new class extends parentClass {
    accept = accept
    parse = parse
  };
};

export const createTypedVOParser = <T>(type: string, parse: ParserParseFunc<T>, parentClass = VOParser): VOParser<T> => {
  return createVOParser(async (opt: ParserAcceptOptions): Promise<boolean> => opt.type == type, parse, parentClass);
};
