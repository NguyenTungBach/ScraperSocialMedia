'use strict';

/**
 * Chạy chuỗi SQL nhiều câu (CREATE / ALTER …) — dùng cho migration sinh từ dump.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

function isTruthy(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function databaseUrlSslEnabled() {
    if (!process.env.DATABASE_URL) {
        return false;
    }

    try {
        return isTruthy(new URL(process.env.DATABASE_URL).searchParams.get('ssl'));
    } catch {
        return false;
    }
}

async function runMultiSql(sql) {
    const useSsl = isTruthy(process.env.DB_SSL) || databaseUrlSslEnabled();
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3308),
        user: process.env.DB_USERNAME || 'atmtc_user',
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : null,
        database: process.env.DB_DATABASE || 'atmtc_db',
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        multipleStatements: true
    });
    try {
        await conn.query(sql);
    } finally {
        await conn.end();
    }
}

/**
 * Dùng trong migration `down`: Sequelize/mysql2 mặc định không gửi nhiều câu SQL trong một query
 * (multipleStatements), nên gộp SET + DROP + SET sẽ lỗi cú pháp trên MariaDB/MySQL.
 */
async function sequelizeDropTable(sequelize, tableName) {
    const safe = String(tableName).replace(/`/g, '');
    await sequelize.query('SET FOREIGN_KEY_CHECKS=0');
    await sequelize.query(`DROP TABLE IF EXISTS \`${safe}\``);
    await sequelize.query('SET FOREIGN_KEY_CHECKS=1');
}

module.exports = { runMultiSql, sequelizeDropTable };
