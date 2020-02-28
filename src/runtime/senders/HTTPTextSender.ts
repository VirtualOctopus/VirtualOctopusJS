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

/**
 * DefaultPooledHTTPTextSender
 */
export class DefaultPooledHTTPTextSender extends PooledVOSender {

    async accept(): Promise<boolean> {
        return true;
    }

    async poolRetrieve(uri: string): Promise<RetrieveResponse> {
        const response = await got(uri);
        return { content: Buffer.from(response.body, "utf8"), type: response.headers["content-type"] };
    }

}


