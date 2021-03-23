import { VOSender, RetrieveResponse } from "./VOSender";
import { Semaphore } from "@newdash/newdash/functional/Semaphore";

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

  async retrieve(uri: string): Promise<RetrieveResponse> {
    const release = await this.acquire(); // require a sem
    try {
      const rt = await this.poolRetrieve(uri);
      return rt;
    } catch (error) {
      throw error;
    } finally {
      release();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async poolRetrieve(uri?: string): Promise<RetrieveResponse> {
    throw new Error("Not impl, please overwrite PooledVOSender.poolRetrieve method");
  }

}