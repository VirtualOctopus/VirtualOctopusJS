import { createVOParser, DefaultAcceptAllFunc, EmptyParserParseFunc } from ".";



describe('VOParser Test Suite', () => {

    it('should accept', async () => {
        const parser = createVOParser(DefaultAcceptAllFunc, EmptyParserParseFunc);
        expect(parser.accept({ uri: "http://xxx/qqq" })).toBeTruthy();
    });

});