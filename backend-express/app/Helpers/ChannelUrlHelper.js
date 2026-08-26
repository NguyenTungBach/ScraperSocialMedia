'use strict';

/**
 * Chuẩn hóa URL kênh/bài để so khớp prefix.
 * - lowercase host
 * - bỏ trailing slash
 * - bỏ query/hash
 */
function normalizeChannelUrl(raw) {
    if (!raw) return '';
    let value = String(raw).trim();
    if (!value) return '';

    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        let pathname = parsed.pathname || '/';
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }
        return `${parsed.protocol}//${host}${pathname === '/' ? '' : pathname}`.toLowerCase();
    } catch {
        value = value.split('?')[0].split('#')[0].replace(/\/+$/, '');
        return value.toLowerCase();
    }
}

/**
 * Từ post_url (có /posts/...) suy ra page URL, rồi chọn channel khớp prefix dài nhất.
 * @param {string|null} postUrl
 * @param {Array<{ id: number, url: string }>} channels
 * @returns {object|null} channel khớp hoặc null
 */
function matchChannelByPostUrl(postUrl, channels) {
    if (!postUrl || !Array.isArray(channels) || channels.length === 0) {
        return null;
    }

    const normalizedPost = normalizeChannelUrl(postUrl);
    if (!normalizedPost) return null;

    let best = null;
    let bestLen = -1;

    for (const channel of channels) {
        const channelUrl = normalizeChannelUrl(channel.url);
        if (!channelUrl) continue;

        const matches =
            normalizedPost === channelUrl ||
            normalizedPost.startsWith(`${channelUrl}/`);

        if (matches && channelUrl.length > bestLen) {
            best = channel;
            bestLen = channelUrl.length;
        }
    }

    return best;
}

/**
 * Trích page URL từ post URL (bỏ /posts/..., /videos/..., /reel/...).
 */
function extractPageUrlFromPostUrl(postUrl) {
    const normalized = normalizeChannelUrl(postUrl);
    if (!normalized) return null;

    const markers = ['/posts/', '/videos/', '/reel/', '/permalink/', '/photo/'];
    for (const marker of markers) {
        const idx = normalized.indexOf(marker);
        if (idx > 0) {
            return normalized.slice(0, idx);
        }
    }
    return normalized;
}

module.exports = {
    normalizeChannelUrl,
    matchChannelByPostUrl,
    extractPageUrlFromPostUrl,
};
