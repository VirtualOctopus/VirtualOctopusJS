import { PooledVOSender } from "./PooledSender";
import { RetrieveResponse } from "./VOSender";

describe('Pooled Sender Test Suite', () => {

    it('should impl pool feature', async () => {

        const limit = 10;

        class DemoPooledSender extends PooledVOSender {

            _current_req_num = 0

            async retrieve(): Promise<RetrieveResponse> {
                const release = await this.acquire();
                return new Promise(resolve => {
                    this._current_req_num++;
                    expect(this._current_req_num <= limit).toBeTruthy();
                    setTimeout(() => {
                        release();
                        this._current_req_num--;
                        resolve({});
                    }, 10);
                });
            }

            async accept(): Promise<boolean> {
                return true;
            }

        }

        const sender = new DemoPooledSender(limit);

        const reqs = [];

        for (let i = 0; i < 100; i++) {
            reqs.push(sender.retrieve());
        }

        await Promise.all(reqs);

        expect(sender._current_req_num).toBe(0);

    });

});