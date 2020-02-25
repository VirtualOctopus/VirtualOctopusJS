import { VOSender, RetrieveResponse } from "./VOSender";
import { Semaphore } from "await-semaphore";
import log4js, { Logger } from 'log4js';

interface ReleaseFunc {
    (): void;
}

const _logger = log4js.getLogger("VO.PooledVOSender");

/**
 * PooledVOSender
 * 
 * remember run `const release = await this.acquire();` to limit request concurrent and release after request
 */
export abstract class PooledVOSender extends VOSender {

    constructor(concurrent = 25) {
        super();
        this.sem = new Semaphore(concurrent);

    }

    private sem: Semaphore = new Semaphore(25);

    protected async acquire(): Promise<ReleaseFunc> {
        return await this.sem.acquire();
    }

    async retrieve(uri: string): Promise<RetrieveResponse> {
        const release = await this.acquire(); // require a sem
        try {
            const rt = await this.poolRetrieve(uri);
            release(); // release sem
            return rt;
        } catch (error) {
            release(); // release
            throw error;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async poolRetrieve(uri?: string): Promise<RetrieveResponse> {
        throw new Error("Not impl, please overwrite PooledVOSender.poolRetrieve method");
    };

}