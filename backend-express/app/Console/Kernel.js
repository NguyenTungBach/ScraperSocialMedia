'use strict';

const SamplePingCommand = require('./Commands/SamplePingCommand');

const COMMANDS = [SamplePingCommand];

function listCommands() {
    return COMMANDS;
}

function listSchedulableCommands() {
    return COMMANDS.filter((CommandClass) => CommandClass.scheduleEnabled !== false);
}

function findCommandBySignature(signature) {
    return COMMANDS.find((CommandClass) => CommandClass.signature === signature) || null;
}

module.exports = {
    listCommands,
    listSchedulableCommands,
    findCommandBySignature
};
