'use strict';

require('dotenv').config();
const scrapeLimits = require('./scrapeLimits');

module.exports = {
    /** Secret — bắt buộc trong .env */
    token: process.env.APIFY_API_TOKEN || '',

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

    facebookCommentsDefaultInput: {
        resultsLimit: scrapeLimits.maxTopComments,
        includeNestedComments: false,
        viewOption: 'RANKED_THREADED',
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

    tiktokCommentsDefaultInput: {
        commentsPerPost: scrapeLimits.maxTopComments,
        maxRepliesPerComment: scrapeLimits.maxReplies,
        excludePinnedPosts: false,
        resultsPerPage: 100,
        profileScrapeSections: ['videos'],
        profileSorting: 'latest',
    },
};
