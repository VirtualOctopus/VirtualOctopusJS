import { VORuntime, createVORuntime } from '../src/runtime/VORuntime';
import { map } from "@newdash/newdash";
import { ResourceProcessStatus } from '../src/runtime/models';
import { DefaultBasicHTTPSender } from '../src/runtime/senders';
import { createCheerioParser } from '../src/runtime/parsers';
import { createTypedVOConsumer } from '../src/runtime/consumers';
import { MemoryStore } from '../src/runtime/stores';

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
        const TYPE_QUOTE_LIST = "object/quote-list";
        const r = await createVORuntime({ pageLimit: 2, checkFinishInterval: 100 });

        const QuoteListParser = createCheerioParser(
            async ({ uri }) => {
                // allow all types response from senders
                return (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            },
            async ($) => {
                const links = map($(".pager a"), e => `http://quotes.toscrape.com${$(e).attr("href")}`);
                const parsedObject = map($(".quote > .text"), e => $(e).text());
                return { type: TYPE_QUOTE_LIST, links, parsedObject };
            }
        );

        const QuoteListConsumer = createTypedVOConsumer(
            TYPE_QUOTE_LIST,
            async (content) => {
                pages++;
                quotes = quotes.concat(content.getContent());
            }
        );

        const HTTPSender = new DefaultBasicHTTPSender();

        const store = new MemoryStore();

        r.with([QuoteListParser, QuoteListConsumer, HTTPSender, store]); // with plugins

        try {
            // await runtime finish processing
            await r.startAt("http://quotes.toscrape.com/page/1/");

            // assert store
            expect((await store.query(ResourceProcessStatus.PROCESSED)).length).toBe(2);

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