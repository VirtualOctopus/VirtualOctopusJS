// @ts-nocheck
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

        const requests = [];

        for (let i = 0; i < reqCount; i++) {
            requests.push(sender.retrieve(""));
        }

        await Promise.all(requests);

        expect(sender._current_req_num).toBe(0);

    });

    it('should throw error & sem works', async () => {

        const concurrent = 5;

        const s1 = new class extends PooledVOSender {
            async accept() { return true; }
        }(concurrent);
        let e = null;

        try {
            await s1.retrieve("anything");
        } catch (error) {
            e = error;
        }

        // error raised
        expect(e instanceof Error).toBeTruthy();

        // @ts-ignore
        expect(s1.sem.count).toBe(concurrent); // sem are release though throw error

    });

});