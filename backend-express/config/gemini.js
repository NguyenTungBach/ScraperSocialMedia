'use strict';

require('dotenv').config();

module.exports = {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: process.env.GEMINI_ENABLED === 'true',
    alertTrendThreshold: Number(process.env.ALERT_TREND_THRESHOLD) || 500,
    alertHotThreshold: Number(process.env.ALERT_HOT_THRESHOLD) || 800,
};
