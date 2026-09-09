'use strict';

const ScraperAsyncStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    STALE: 'stale',
};

const ScraperAsyncType = {
    YOUTUBE_SCRAPE: 'youtube_scrape',
    TIKTOK_SCRAPE: 'tiktok_scrape',
    FACEBOOK_SCRAPE: 'facebook_scrape',
    COMMENT_ANALYSIS: 'comment_analysis',
    POST_REFRESH: 'post_refresh',
};

const ACTIVE_STATUSES = [ScraperAsyncStatus.PENDING, ScraperAsyncStatus.RUNNING];

const TERMINAL_STATUSES = [
    ScraperAsyncStatus.COMPLETED,
    ScraperAsyncStatus.FAILED,
    ScraperAsyncStatus.STALE,
];

module.exports = {
    ScraperAsyncStatus,
    ScraperAsyncType,
    ACTIVE_STATUSES,
    TERMINAL_STATUSES,
};
