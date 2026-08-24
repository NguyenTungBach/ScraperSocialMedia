'use strict';

/**
 * Hạ tầng tối thiểu dùng chữ ký SES — tách khỏi Contact / Org account để tránh nhân đôi credential.
 */
const { SESv2Client } = require('@aws-sdk/client-sesv2');
const mailConfig = require('../../config/mail');

function buildSesClient() {
    const region = mailConfig.sesRegion();
    const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    /** @type {import('@aws-sdk/client-sesv2').SESv2ClientConfig} */
    const opts = { region };
    if (accessKeyId && secretAccessKey) {
        opts.credentials = { accessKeyId, secretAccessKey };
    }
    return new SESv2Client(opts);
}

module.exports = { buildSesClient };
