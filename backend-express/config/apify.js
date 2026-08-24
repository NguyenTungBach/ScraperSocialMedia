'use strict';

require('dotenv').config();

module.exports = {
    token: process.env.APIFY_API_TOKEN || '',
    facebookActorId: process.env.APIFY_FACEBOOK_ACTOR_ID || 'KoJrdxJCTtpon81KY',
    defaultInput: {
        captionText: false,
        resultsLimit: Number(process.env.APIFY_FACEBOOK_RESULTS_LIMIT) || 5,
        startUrls: [
            { url: 'https://www.facebook.com/Theanh28' },
            { url: 'https://www.facebook.com/tintucvtv24' },
        ],
    },
};
