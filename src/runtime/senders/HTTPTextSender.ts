import { VOSender } from "./VOSender";
import got from "got";

export abstract class HTTPTextSender extends VOSender {

}

/**
 * 
 * DefaultHTTPTextSender
 * 
 * Basic impl for text html
 * 
 */
export class DefaultHTTPTextSender extends HTTPTextSender {

    async accept(): Promise<boolean> {
        return true;
    }

    async retrieve(uri: string): Promise<Buffer> {
        const response = await got(uri);
        return Buffer.from(response.body, "utf8");
    }


}