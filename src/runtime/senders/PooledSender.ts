import { VOSender } from "./VOSender";
import { Semaphore } from "await-semaphore";

interface ReleaseFunc {
    (): void;
}

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

}