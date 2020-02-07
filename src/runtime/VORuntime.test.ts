import { VORuntime, createVORuntime } from './VORuntime';
import HTTPTextParser from './parsers/HTTPTextParser';
import { ParseResult } from './parsers/VOParser';
import cheerio from "cheerio";
import { map } from "lodash";
import { HTTPTextConsumer } from './consumers/HTTPTextConsumer';
import { Content } from './models';
import { DefaultHTTPTextSender } from './senders/HTTPTextSender';

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

    it('should scrabe quotes', async () => {

        let pages = 0;
        let quotes = [];
        const r = await createVORuntime({ pageLimit: 2, checkFinishInterval: 100 });

        class Parser extends HTTPTextParser {

            async parseText(html: string): Promise<ParseResult<any>> {
                const rt: ParseResult = {};
                const $ = cheerio.load(html);

                rt.links = map($(".pager a"), e => `http://quotes.toscrape.com${$(e).attr("href")}`);

                rt.parsedObject = map($(".quote > .text"), e => $(e).text());

                return rt;
            }

            async accept(uri: string): Promise<boolean> {
                return (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            }

        }

        class Consumer extends HTTPTextConsumer {

            async accept(uri: string): Promise<boolean> {
                return (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            }

            async consume(content: Content<string[]>): Promise<void> {
                pages++;
                quotes = quotes.concat(content.getContent());
            }

        }

        r.with([new Parser(), new Consumer(), new DefaultHTTPTextSender()]);

        try {
            await r.startAt("http://quotes.toscrape.com/page/1/");
        } finally {
            await r.destroy();
        }

        expect(pages).toBe(2);

        expect(quotes.length).toBe(20);


    });

});