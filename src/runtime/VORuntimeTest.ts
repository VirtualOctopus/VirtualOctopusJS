import { VORuntime } from './VORuntime';

describe('VO Runtime Test Suite', () => {

    it('should create & destroy database', (cb) => {
        new VORuntime(async (r, err) => {
            if (err) {
                expect(err).toBe(undefined);
            } else {
                await r.destroy();
            }
            cb();
        });
    });

});