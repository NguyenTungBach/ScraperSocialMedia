'use strict';

const MailService = require('../Services/MailService');
const logger = require('../Logging/logger');

/**
 * Sample queue job — gửi email HTML.
 * Dispatch: `Job.dispatch('SendMailJob', { to, subject, html })`
 */
class SendMailJob {
    /**
     * @param {{ to?: string, subject?: string, html?: string, bcc?: string[] }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    async handle() {
        const to = this.data.to;
        const subject = this.data.subject || '(no subject)';
        const html = this.data.html || '<p></p>';
        const ok = await MailService.sendHtml({
            to,
            subject,
            html,
            bcc: this.data.bcc
        });
        if (!ok) {
            const err = new Error('SendMailJob: mail send failed or not configured');
            logger.error(err.message, { to, subject });
            throw err;
        }
        return { ok: true };
    }
}

module.exports = SendMailJob;
