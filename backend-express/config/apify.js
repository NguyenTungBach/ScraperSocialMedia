'use strict';

require('dotenv').config();
const scrapeLimits = require('./scrapeLimits');
const SettingsCache = require('../app/Services/SettingsCache');

module.exports = {
    /** Secret — lấy từ key_scraps (APIFY_API_TOKEN) */
    get token() {
        return SettingsCache.get('APIFY_API_TOKEN') || '';
    },

    /** Actor IDs cố định trong code (không cần .env — chỉ là endpoint Apify). */
    facebookActorId: 'KoJrdxJCTtpon81KY',
    facebookPagesActorId: 'apify/facebook-pages-scraper',
    facebookCommentsActorId: 'apify/facebook-comments-scraper',
    tiktokActorId: 'clockworks/free-tiktok-scraper',
    tiktokCommentsActorId: 'BDec00yAmCm1QbMEI',

    facebookResultsLimit: scrapeLimits.maxPosts,
    facebookCommentsPerPost: scrapeLimits.maxTopComments,
    facebookMaxRepliesPerComment: scrapeLimits.maxReplies,

    defaultInput: {
        captionText: false,
        resultsLimit: scrapeLimits.maxPosts,
        startUrls: [
            { url: 'https://www.facebook.com/Theanh28' },
            { url: 'https://www.facebook.com/tintucvtv24' },
        ],
    },

    /** RANKED_UNFILTERED = “Phù hợp nhất” (default Facebook). Không dùng RECENT_ACTIVITY. */
    facebookCommentsDefaultInput: {
        resultsLimit: scrapeLimits.maxTopComments,
        includeNestedComments: false,
        viewOption: 'RANKED_UNFILTERED',
    },

    tiktokResultsPerPage: scrapeLimits.maxPosts,
    tiktokCommentsPerPost: scrapeLimits.maxTopComments,
    tiktokMaxRepliesPerComment: scrapeLimits.maxReplies,

    tiktokVideoDefaultInput: {
        excludePinnedPosts: false,
        resultsPerPage: scrapeLimits.maxPosts,
        profileScrapeSections: ['videos'],
        profileSorting: 'latest',
        commentsPerPost: 0,
        topLevelCommentsPerPost: 0,
        maxRepliesPerComment: 0,
        shouldDownloadAvatars: false,
        shouldDownloadCovers: false,
        shouldDownloadMusicCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadVideos: false,
        scrapeRelatedVideos: false,
        scrapeRelatedSearchWords: false,
        scrapeAdditionalAuthorMeta: false,
        aiVideoDescription: false,
        aiVideoSummary: false,
        downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES',
        proxyCountryCode: 'None',
    },

    /**
     * Clockworks TikTok Comments: không có sortBy — API trả theo Top (mặc định TikTok).
     * topLevelCommentsPerPost giới hạn comment gốc; maxRepliesPerComment = reply/thread.
     */
    tiktokCommentsDefaultInput: {
        commentsPerPost: scrapeLimits.maxTopComments,
        topLevelCommentsPerPost: scrapeLimits.maxTopComments,
        maxRepliesPerComment: scrapeLimits.maxReplies,
        excludePinnedPosts: false,
        resultsPerPage: 100,
        profileScrapeSections: ['videos'],
        profileSorting: 'latest',
    },
};
