'use strict';

require('dotenv').config();
const cron = require('node-cron');
const logger = require('../app/Logging/logger');
const { listSchedulableCommands } = require('../app/Console/Kernel');

const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tokyo';
const COMMANDS = listSchedulableCommands();
const runningBySignature = new Set();

async function runCommand(CommandClass) {
    const signature = CommandClass.signature || CommandClass.name || 'unknown:command';
    if (runningBySignature.has(signature)) {
        logger.warn('Scheduled command is already running, skipping this tick', { signature });
        return;
    }

    runningBySignature.add(signature);
    try {
        const cmd = new CommandClass();
        const result = await cmd.handle();
        logger.info('Scheduled command completed', { signature, result });
    } catch (error) {
        logger.error('Scheduled command failed', {
            signature,
            error: error.message,
            stack: error.stack
        });
    } finally {
        runningBySignature.delete(signature);
    }
}

function shutdown(signal) {
    logger.info('Scheduler worker shutting down', { signal });
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const CommandClass of COMMANDS) {
    const signature = CommandClass.signature || CommandClass.name || 'unknown:command';
    const expression = CommandClass.schedule;
    if (!expression || !cron.validate(expression)) {
        logger.error('Invalid command schedule', { signature, expression });
        process.exit(1);
    }

    cron.schedule(
        expression,
        async () => {
            await runCommand(CommandClass);
        },
        { timezone: TIMEZONE }
    );
}

logger.info('Scheduler worker started', {
    timezone: TIMEZONE,
    commands: COMMANDS.map((CommandClass) => ({
        signature: CommandClass.signature || CommandClass.name || 'unknown:command',
        schedule: CommandClass.schedule || null
    }))
});
