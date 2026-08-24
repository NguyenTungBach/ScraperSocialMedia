'use strict';

/**
 * Gửi email HTML qua SMTP (nodemailer) hoặc AWS SES.
 * Cấu hình: `config/mail.js` + biến MAIL_* / AWS_SES_* trong `.env`.
 */
const nodemailer = require('nodemailer');
const { SendEmailCommand } = require('@aws-sdk/client-sesv2');
const mailConfig = require('../../config/mail');
const { buildSesClient } = require('../Helpers/MailInfrastructure');
const logger = require('../Logging/logger');

const LOG_PREFIX = '[mail]';

function isValidRecipient(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * @param {{ to: string, subject: string, html: string, bcc?: string[] }} opts
 * @returns {Promise<boolean>}
 */
async function sendHtml(opts) {
    const to = String(opts.to || '').trim();
    const subject = opts.subject || '';
    const html = opts.html || '';
    const bccList = Array.isArray(opts.bcc)
        ? opts.bcc.map((e) => String(e).trim()).filter((e) => e && e !== to && isValidRecipient(e))
        : [];

    if (!isValidRecipient(to)) {
        logger.warn(`${LOG_PREFIX} invalid recipient`, { to });
        return false;
    }
    if (!mailConfig.isTransportReady()) {
        logger.warn(`${LOG_PREFIX} transport not configured`, {
            subject,
            hint: 'MAIL_FROM_ADDRESS + (MAIL_HOST or MAIL_MAILER=ses + region)'
        });
        return false;
    }

    const fromHeader = `"${mailConfig.fromName}" <${mailConfig.fromAddress}>`;

    if (mailConfig.getMailerType() === 'ses') {
        try {
            const client = buildSesClient();
            /** @type {{ ToAddresses: string[]; BccAddresses?: string[] }} */
            const destination = { ToAddresses: [to] };
            if (bccList.length) {
                destination.BccAddresses = bccList;
            }
            await client.send(
                new SendEmailCommand({
                    FromEmailAddress: fromHeader,
                    Destination: destination,
                    Content: {
                        Simple: {
                            Subject: { Data: subject, Charset: 'UTF-8' },
                            Body: { Html: { Data: html, Charset: 'UTF-8' } }
                        }
                    }
                })
            );
            logger.info(`${LOG_PREFIX} sent (SES)`, { to, subject, bcc_count: bccList.length });
            return true;
        } catch (e) {
            logger.error(`${LOG_PREFIX} SES failed`, { subject, message: e?.message });
            return false;
        }
    }

    try {
        const transporter = nodemailer.createTransport(mailConfig.transportOptions);
        await transporter.sendMail({
            from: fromHeader,
            to,
            bcc: bccList.length ? bccList : undefined,
            subject,
            html
        });
        logger.info(`${LOG_PREFIX} sent (SMTP)`, { to, subject, bcc_count: bccList.length });
        return true;
    } catch (e) {
        logger.error(`${LOG_PREFIX} SMTP failed`, { subject, message: e?.message });
        return false;
    }
}

module.exports = {
    sendHtml,
    isValidRecipient
};
