'use strict';

const {
    isApifyErrorItem,
    partitionApifyItems,
    buildChannelNotPublicEntry,
    CHANNEL_NOT_PUBLIC,
} = require('../../../app/Helpers/ScraperAccessHelper');

describe('ScraperAccessHelper', () => {
    it('detects Apify error items', () => {
        expect(isApifyErrorItem({ error: 'not_available' })).toBe(true);
        expect(isApifyErrorItem({ postId: '123' })).toBe(false);
    });

    it('partitions error and ok items', () => {
        const items = [
            { error: 'not_available', url: 'https://facebook.com/x' },
            { postId: '1', url: 'https://facebook.com/post/1' },
        ];
        const { errors, ok } = partitionApifyItems(items);
        expect(errors).toHaveLength(1);
        expect(ok).toHaveLength(1);
    });

    it('builds channel_not_public entry', () => {
        const entry = buildChannelNotPublicEntry({ id: 5, name: 'Test' }, 'Private');
        expect(entry.reason).toBe(CHANNEL_NOT_PUBLIC);
        expect(entry.channel_id).toBe(5);
        expect(entry.message).toBe('Private');
    });
});
