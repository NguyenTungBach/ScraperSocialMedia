'use strict';

/**
 * PM2: một process API + một queue worker + một scheduler.
 * Quy ước tên:
 *   - API:       `${PM2_API_NAME}`
 *   - Queue:     `${PM2_API_NAME}-queue`
 *   - Scheduler: `${PM2_API_NAME}-schedule`  (đọc general_schedules, spawn npm run app:*)
 * Chỉ cần set PM2_API_NAME (và APP_PORT).
 * Timezone lịch: APP_TIMEZONE (mặc định Asia/Ho_Chi_Minh).
 * Sau khi bật *-schedule, tắt crontab/GH Actions trùng để tránh chạy đôi.
 *
 * Start / reload cả ba:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs
 * Hoặc: npm run pm2:start | npm run pm2:reload
 *
 * Biến có thể set trong .env trên server hoặc export trước khi gọi pm2 (CI):
 *   PM2_API_NAME, APP_PORT, NODE_ENV, PM2_NODE_INTERPRETER (đường dẫn node, mặc định nvm trên server deploy).
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const apiName = process.env.PM2_API_NAME || 'scrap-social-media-api';
const port = Number(process.env.APP_PORT || process.env.PORT || 3400);
const nodeEnv = process.env.NODE_ENV || 'production';
/** PM2 node binary — override bằng PM2_NODE_INTERPRETER nếu cần. */
const nodeInterpreter = process.env.PM2_NODE_INTERPRETER || 'node';

module.exports = {
    apps: [
        {
            name: apiName,
            script: './server.js',
            cwd: __dirname,
            interpreter: nodeInterpreter,
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: nodeEnv,
                PORT: port,
                APP_PORT: port,
            },
        },
        {
            name: `${apiName}-queue`,
            script: './scripts/queue-worker.js',
            cwd: __dirname,
            interpreter: nodeInterpreter,
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: nodeEnv,
            },
        },
        {
            name: `${apiName}-schedule`,
            script: './scripts/scheduler.js',
            cwd: __dirname,
            interpreter: nodeInterpreter,
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: nodeEnv,
            },
        },
    ],
};
