import { createVOParser, ParserDefaultAcceptAllFunc, ParserDefaultEmptyParseFunc } from "../src/runtime/parsers";
import { createTypedVOParser } from "../src/runtime/parsers/VOParser";


describe('VOParser Test Suite', () => {

    it('should accept', async () => {
        const parser = createVOParser(ParserDefaultAcceptAllFunc, ParserDefaultEmptyParseFunc);
        expect(await parser.accept({ uri: "http://xxx/qqq" })).toBeTruthy();

        const parser2 = createVOParser(async ({ uri, type }) => {
            if (uri && uri.endsWith("123456")) {
                return true;
            }
            if (type == "type1") {
                return true;
            }
            return false;
        }, ParserDefaultEmptyParseFunc);

        expect(await parser2.accept({ uri: "http://xxx/123456" })).toBeTruthy();
        expect(await parser2.accept({ uri: "http://xxx/12345" })).toBeFalsy();

        expect(await parser2.accept({ type: "type1" })).toBeTruthy();
        expect(await parser2.accept({ type: "12345" })).toBeFalsy();

        const parser3 = createTypedVOParser("type1", ParserDefaultEmptyParseFunc);

        expect(await parser3.accept({ type: "type1" })).toBeTruthy();
        expect(await parser3.accept({ type: "12345" })).toBeFalsy();

    });

});