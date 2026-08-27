'use strict';

require('dotenv').config();

module.exports = {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    defaultMaxResults: Number(process.env.YOUTUBE_MAX_RESULTS) || 10,
    maxTopComments: Number(process.env.YOUTUBE_MAX_TOP_COMMENTS) || 20,
    maxReplies: Number(process.env.YOUTUBE_MAX_REPLIES) || 10,
};
