#!/usr/bin/env node
'use strict';

/**
 * Xuất OpenAPI JSON giống ý "generate swagger" (Laravel: php artisan l5-swagger:generate).
 * Nguồn: `config/swagger.js` + JSDoc `@openapi` trong controllers/routes + YAML trong docs/openapi.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerConfig = require('../config/swagger');

const spec = swaggerJsdoc(swaggerConfig);
const outDir = path.join(__dirname, '../docs/openapi/generated');
const outPath = path.join(outDir, 'openapi.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

console.log(`OpenAPI written to ${outPath}`);
