'use strict';

const CHANNEL_NOT_PUBLIC = 'channel_not_public';

function isApifyErrorItem(item) {
    if (!item || typeof item !== 'object') return false;
    return Boolean(item.error || item.errorDescription || item.errorMessage);
}

function apifyErrorMessage(item) {
    if (!item || typeof item !== 'object') return null;
    return (
        item.errorDescription ||
        item.errorMessage ||
        (item.error ? String(item.error) : null) ||
        null
    );
}

/**
 * @param {object[]} items
 * @returns {{ errors: object[], ok: object[] }}
 */
function partitionApifyItems(items) {
    const errors = [];
    const ok = [];
    for (const item of items || []) {
        if (isApifyErrorItem(item)) errors.push(item);
        else ok.push(item);
    }
    return { errors, ok };
}

function buildChannelNotPublicEntry(channel, message) {
    return {
        channel_id: channel.id,
        name: channel.name,
        reason: CHANNEL_NOT_PUBLIC,
        message:
            message ||
            'Kênh không công khai hoặc không truy cập được (private/ẩn)',
    };
}

module.exports = {
    CHANNEL_NOT_PUBLIC,
    isApifyErrorItem,
    apifyErrorMessage,
    partitionApifyItems,
    buildChannelNotPublicEntry,
};
