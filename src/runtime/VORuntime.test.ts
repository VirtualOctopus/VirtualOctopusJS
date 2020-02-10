import { VORuntime, createVORuntime } from './VORuntime';
import HTTPTextParser from './parsers/HTTPTextParser';
import { ParseResult, ParserAcceptOptions } from './parsers/VOParser';
import cheerio from "cheerio";
import { map } from "lodash";
import { Content } from './models';
import { DefaultHTTPTextSender } from './senders/HTTPTextSender';
import { VOConsumer, ConsumerAcceptOptions } from './consumers/VOConsumer';

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

            async accept({ uri }: ParserAcceptOptions): Promise<boolean> {
                // allow all types response from senders
                return (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            }

            async parseText(html: string): Promise<ParseResult<any>> {
                const rt: ParseResult = {};
                const $ = cheerio.load(html);

                rt.type = "object/quotelist"; // this parser just return the 'object/quotelist' type response

                rt.links = map($(".pager a"), e => `http://quotes.toscrape.com${$(e).attr("href")}`);

                rt.parsedObject = map($(".quote > .text"), e => $(e).text());

                return rt;
            }


        }

        class QuoteListConsumer extends VOConsumer {

            async accept({ uri, type }: ConsumerAcceptOptions): Promise<boolean> {
                return type == "object/quotelist" && (uri == "http://quotes.toscrape.com/" || uri.startsWith("http://quotes.toscrape.com/page/"));
            }

            async consume(content: Content<string[]>): Promise<void> {
                pages++;
                quotes = quotes.concat(content.getContent());
            }

        }

        r.with([new Parser(), new QuoteListConsumer(), new DefaultHTTPTextSender()]);

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