#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { loadEnvConfig } = require('@next/env');

const projectDir = path.resolve(__dirname, '..');
const cmd = process.argv[2];

if (cmd !== 'dev' && cmd !== 'start') {
  console.error('Usage: node scripts/next-with-env.js <dev|start>');
  process.exit(1);
}

loadEnvConfig(projectDir, cmd === 'dev');

if (!process.env.PORT && process.env.FE_PORT) {
  process.env.PORT = process.env.FE_PORT;
}

const port = String(process.env.PORT || '3000');
const nextBin = require.resolve('next/dist/bin/next');
const extra = process.argv.slice(3);

const child = spawn(
  process.execPath,
  [nextBin, cmd, '-H', '0.0.0.0', '-p', port, ...extra],
  { stdio: 'inherit', cwd: projectDir, env: process.env }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code == null ? 0 : code);
});
