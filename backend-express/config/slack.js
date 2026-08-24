'use strict';

/**
 * Slack Incoming Webhook + Slash Command config.
 */
module.exports = {
    get webhookUrl() {
        return String(process.env.SLACK_WEBHOOK_URL || '').trim();
    },

    get signingSecret() {
        return String(process.env.SLACK_SIGNING_SECRET || '').trim();
    },

    /** Shared secret for POST /api/slack-send (header X-Notify-Secret). */
    get notifySecret() {
        return String(process.env.SLACK_NOTIFY_SECRET || '').trim();
    },

    get siteUrl() {
        return String(process.env.FE_URL || process.env.APP_URL || 'https://hoyocodes.onrender.com')
            .trim()
            .replace(/\/+$/, '');
    },

    isWebhookReady() {
        return Boolean(this.webhookUrl);
    },
};
