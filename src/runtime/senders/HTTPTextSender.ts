import { VOSender, RetrieveResponse } from "./VOSender";
import got from "got";
import { PooledVOSender } from "./PooledSender";

/**
 * 
 * DefaultHTTPTextSender
 * 
 * Basic impl for text html
 * 
 */
export class DefaultHTTPTextSender extends VOSender {

    async accept(): Promise<boolean> {
        return true;
    }

    async retrieve(uri: string): Promise<RetrieveResponse> {
        const response = await got(uri);
        return { content: Buffer.from(response.body, "utf8"), type: response.headers["content-type"] };
    }

}


export class DefaultPooledHTTPTextSender extends PooledVOSender {

    async accept(): Promise<boolean> {
        return true;
    }

    async retrieve(uri: string): Promise<RetrieveResponse> {
        const release = await this.acquire();
        const response = await got(uri);
        release();
        return { content: Buffer.from(response.body, "utf8"), type: response.headers["content-type"] };
    }

}


