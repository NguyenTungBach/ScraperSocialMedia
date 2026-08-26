'use strict';

require('dotenv').config();

module.exports = {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    defaultMaxResults: Number(process.env.YOUTUBE_MAX_RESULTS) || 10,
};
