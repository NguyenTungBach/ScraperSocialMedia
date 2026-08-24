'use strict';

require('dotenv').config();
const logger = require('../app/Logging/logger');
const { findCommandBySignature, listCommands } = require('../app/Console/Kernel');

async function main() {
    const signature = process.argv[2];
    if (!signature) {
        const available = listCommands().map((CommandClass) => CommandClass.signature).filter(Boolean);
        logger.error('Missing command signature. Usage: node scripts/run-command.js <signature>', { available });
        process.exit(1);
    }

    const CommandClass = findCommandBySignature(signature);
    if (!CommandClass) {
        const available = listCommands().map((C) => C.signature).filter(Boolean);
        logger.error('Command not found', { signature, available });
        process.exit(1);
    }

    try {
        const cmd = new CommandClass();
        const result = await cmd.handle();
        logger.info('Command executed successfully', { signature, result });
        process.exit(0);
    } catch (error) {
        logger.error('Command execution failed', {
            signature,
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

main();
