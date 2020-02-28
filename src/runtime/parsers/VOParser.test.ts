import { createVOParser, DefaultAcceptAllFunc, EmptyParserParseFunc } from ".";
import { createTypedVOParser } from "./VOParser";



describe('VOParser Test Suite', () => {

    it('should accept', async () => {
        const parser = createVOParser(DefaultAcceptAllFunc, EmptyParserParseFunc);
        expect(await parser.accept({ uri: "http://xxx/qqq" })).toBeTruthy();

        const parser2 = createVOParser(async ({ uri, type }) => {
            if (uri && uri.endsWith("123456")) {
                return true;
            }
            if (type == "type1") {
                return true;
            }
            return false;
        }, EmptyParserParseFunc);

        expect(await parser2.accept({ uri: "http://xxx/123456" })).toBeTruthy();
        expect(await parser2.accept({ uri: "http://xxx/12345" })).toBeFalsy();

        expect(await parser2.accept({ type: "type1" })).toBeTruthy();
        expect(await parser2.accept({ type: "12345" })).toBeFalsy();

        const parser3 = createTypedVOParser("type1", EmptyParserParseFunc);

        expect(await parser3.accept({ type: "type1" })).toBeTruthy();
        expect(await parser3.accept({ type: "12345" })).toBeFalsy();

    });

});