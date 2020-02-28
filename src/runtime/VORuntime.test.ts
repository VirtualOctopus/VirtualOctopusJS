import { VORuntime, createVORuntime } from './VORuntime';
import { map } from "lodash";
import { Content } from './models';
import { DefaultHTTPTextSender } from './senders';
import { AbstractCheerIOParser, ParseResult, ParserAcceptOptions, createCheerioParser } from './parsers';
import { createTypedVOConsumer } from './consumers';

describe('VO Runtime Test Suite', () => {

    it('should create & destroy database', (cb) => {
        new VORuntime({}, async (r, err) => {
            if (err) {
                expect(err).toBe(undefined);
            } else {
                await r.destroy();
            }
            cb();
        });
    });

    it('should create parallel runtime', async () => {
        const r = await createVORuntime();
        expect(r).not.toBeNull();
        await r.destroy();
    });

    it('should scrape quotes', async () => {

        let pages = 0;
        let quotes = [];
        const r = await createVORuntime({ pageLimit: 2, checkFinishInterval: 100 });

        const QuoteListParser = createCheerioParser(
            async ({ uri }: ParserAcceptOptions): Promise<boolean> => {
                // allow all types response from senders
                return (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            },
            async ($: CheerioStatic): Promise<ParseResult<any>> => {
                const links = map($(".pager a"), e => `http://quotes.toscrape.com${$(e).attr("href")}`);
                const parsedObject = map($(".quote > .text"), e => $(e).text());
                return { type: "object/quote-list", links, parsedObject };
            }
        );

        const QuoteListConsumer = createTypedVOConsumer("object/quote-list", async (content: Content<string[]>): Promise<void> => {
            pages++;
            quotes = quotes.concat(content.getContent());
        });

        const HTTPSender = new DefaultHTTPTextSender();

        r.with([QuoteListParser, QuoteListConsumer, HTTPSender]);

        try {
            await r.startAt("http://quotes.toscrape.com/page/1/");
        } finally {
            await r.destroy();
        }

        // assert the page limit
        expect(pages).toBe(2);

        // assert the first quote
        expect(quotes[0])
            .toEqual("“The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.”");

        // assert the quotes number
        expect(quotes.length).toBe(20);


    });

});