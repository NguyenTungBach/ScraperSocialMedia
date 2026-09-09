const { isQueueJobRetriable } = require('../../../app/Helpers/QueueRetriableHelper');

describe('QueueRetriableHelper', () => {
    describe('isQueueJobRetriable', () => {
        it('returns false for Apify quota exceeded (403)', () => {
            const error = Object.assign(new Error('Monthly usage hard limit exceeded'), {
                statusCode: 403,
                type: 'platform-feature-disabled',
            });
            expect(isQueueJobRetriable(error)).toBe(false);
        });

        it('returns false for validation errors (422)', () => {
            const error = Object.assign(new Error('scraper_run not found'), { statusCode: 404 });
            expect(isQueueJobRetriable(error)).toBe(false);
        });

        it('returns true for deadlock', () => {
            const error = Object.assign(new Error('Deadlock found when trying to get lock'), {
                parent: { code: 'ER_LOCK_DEADLOCK', errno: 1213 },
            });
            expect(isQueueJobRetriable(error)).toBe(true);
        });

        it('returns true for transient network errors', () => {
            const error = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
            expect(isQueueJobRetriable(error)).toBe(true);
        });

        it('returns true for 503 service unavailable', () => {
            const error = Object.assign(new Error('Service unavailable'), { statusCode: 503 });
            expect(isQueueJobRetriable(error)).toBe(true);
        });
    });
});
