'use strict';

require('dotenv').config();
const logger = require('../app/Logging/logger');
const { findCommandBySignature, listCommands } = require('../app/Console/Kernel');
const { flushPendingServiceFailureAlerts } = require('../app/Services/ServiceFailureAlertService');

async function exitWithCode(code) {
    // Alert Apify/YouTube/Gemini fire-and-forget — phải chờ SMTP xong trước khi kill process.
    try {
        await flushPendingServiceFailureAlerts();
    } catch (flushErr) {
        logger.error('Failed to flush service-failure alerts', { message: flushErr?.message });
    }
    process.exit(code);
}

async function main() {
    const signature = process.argv[2];
    if (!signature) {
        const available = listCommands().map((CommandClass) => CommandClass.signature).filter(Boolean);
        logger.error('Missing command signature. Usage: node scripts/run-command.js <signature>', { available });
        await exitWithCode(1);
    }

    const CommandClass = findCommandBySignature(signature);
    if (!CommandClass) {
        const available = listCommands().map((C) => C.signature).filter(Boolean);
        logger.error('Command not found', { signature, available });
        await exitWithCode(1);
    }

    try {
        const cmd = new CommandClass();
        const result = await cmd.handle();
        logger.info('Command executed successfully', { signature, result });
        await exitWithCode(0);
    } catch (error) {
        logger.error('Command execution failed', {
            signature,
            error: error.message,
            stack: error.stack,
        });
        await exitWithCode(1);
    }
}

main();
