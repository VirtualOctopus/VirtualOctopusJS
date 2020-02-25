import { PooledVOSender } from "./PooledSender";
import { RetrieveResponse } from "./VOSender";

describe('Pooled Sender Test Suite', () => {

    it('should impl pool feature', async () => {

        const limit = 15;

        const reqCount = 100;

        class DemoPooledSender extends PooledVOSender {

            _current_req_num = 0

            async poolRetrieve(): Promise<RetrieveResponse> {
                this._current_req_num++;
                expect(this._current_req_num <= limit).toBeTruthy();
                await new Promise(resolve => { setTimeout(() => { resolve(); }, 10); });
                this._current_req_num--;
                return {};
            }

            async accept(): Promise<boolean> {
                return true;
            }

        }

        const sender = new DemoPooledSender(limit);

        const reqs = [];

        for (let i = 0; i < reqCount; i++) {
            reqs.push(sender.retrieve(""));
        }

        await Promise.all(reqs);

        expect(sender._current_req_num).toBe(0);

    });

});