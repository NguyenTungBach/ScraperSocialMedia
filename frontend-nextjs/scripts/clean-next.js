#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '.next');

if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Removed .next cache');
}
