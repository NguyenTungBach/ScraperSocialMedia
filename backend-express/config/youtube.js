'use strict';

require('dotenv').config();
const scrapeLimits = require('./scrapeLimits');
const SettingsCache = require('../app/Services/SettingsCache');

module.exports = {
    get apiKey() {
        return SettingsCache.get('YOUTUBE_API_KEY') || '';
    },
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    defaultMaxResults: scrapeLimits.maxPosts,
    headSize: Number(process.env.YOUTUBE_HEAD_SIZE) || scrapeLimits.maxPosts,
    tailBatchSize: Number(process.env.YOUTUBE_TAIL_BATCH_SIZE) || 50,
    maxTopComments: scrapeLimits.maxTopComments,
    maxReplies: scrapeLimits.maxReplies,
};
