'use strict';

const path = require('path');

const COMMAND_RE = /^npm run (app:[a-z0-9-]+)$/;

function loadPackageScripts() {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const pkg = require(path.join(__dirname, '../../package.json'));
    return pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
}

/**
 * @returns {string[]} e.g. ['npm run app:alert-gmail', ...]
 */
function listAllowedCommands() {
    const scripts = loadPackageScripts();
    return Object.keys(scripts)
        .filter((key) => key.startsWith('app:'))
        .sort()
        .map((key) => `npm run ${key}`);
}

/**
 * @param {string} command
 * @returns {{ ok: true, command: string } | { ok: false, message: string }}
 */
function validateAllowedCommand(command) {
    const trimmed = String(command || '').trim();
    const match = COMMAND_RE.exec(trimmed);
    if (!match) {
        return {
            ok: false,
            message: 'command must match "npm run app:<name>"',
        };
    }
    const scriptName = match[1];
    const scripts = loadPackageScripts();
    if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
        return {
            ok: false,
            message: `Unknown npm script: ${scriptName}`,
        };
    }
    return { ok: true, command: `npm run ${scriptName}` };
}

module.exports = {
    COMMAND_RE,
    listAllowedCommands,
    validateAllowedCommand,
};
