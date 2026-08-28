'use strict';

const SamplePingCommand = require('./Commands/SamplePingCommand');
const AlertGmailCommand = require('./Commands/AlertGmailCommand');
const YoutubeTailRefreshCommand = require('./Commands/YoutubeTailRefreshCommand');
const YoutubeScrapeCommand = require('./Commands/YoutubeScrapeCommand');

const COMMANDS = [
    SamplePingCommand,
    AlertGmailCommand,
    YoutubeTailRefreshCommand,
    YoutubeScrapeCommand,
];

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
