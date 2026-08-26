'use strict';

/**
 * One-off: drop Supabase public tables, migrate schema, import MySQL dump data.
 * Usage: node scripts/import-mysql-dump-to-supabase.js [path-to.sql]
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { execSync } = require('child_process');

const SQL_PATH =
    process.argv[2] ||
    path.join('C:', 'Users', 'admin', 'Downloads', 'scraper_social_media.sql');

const IMPORT_ORDER = [
    'users',
    'channels',
    'subjects',
    'subject_channels',
    'scraper_runs',
    'subjects_scraper_runs',
    'social_posts',
];

function dbClient() {
    return new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE || 'postgres',
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
    });
}

async function dropAllPublicTables(client) {
    const { rows } = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    `);

    if (!rows.length) {
        console.log('No public tables to drop.');
        return;
    }

    const names = rows.map((r) => `"${r.tablename}"`).join(', ');
    console.log(`Dropping ${rows.length} tables:`, rows.map((r) => r.tablename).join(', '));
    await client.query(`DROP TABLE IF EXISTS ${names} CASCADE`);
}

function mysqlEscapesToPostgres(sql) {
    // Convert MySQL \' escape sequences inside string literals to Postgres ''.
    let out = '';
    let inString = false;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        if (!inString) {
            if (ch === "'") {
                inString = true;
                out += ch;
            } else {
                out += ch;
            }
            continue;
        }

        if (ch === '\\' && i + 1 < sql.length) {
            const next = sql[i + 1];
            if (next === "'") {
                out += "''";
                i++;
                continue;
            }
            if (next === '\\') {
                out += '\\';
                i++;
                continue;
            }
            if (next === 'n') {
                out += '\n';
                i++;
                continue;
            }
            if (next === 'r') {
                out += '\r';
                i++;
                continue;
            }
            if (next === 't') {
                out += '\t';
                i++;
                continue;
            }
            out += next;
            i++;
            continue;
        }

        if (ch === "'") {
            // MySQL '' or end of string
            if (i + 1 < sql.length && sql[i + 1] === "'") {
                out += "''";
                i++;
                continue;
            }
            inString = false;
            out += ch;
            continue;
        }

        out += ch;
    }
    return out;
}

function extractInserts(dump) {
    const byTable = new Map();
    const re = /INSERT INTO `([^`]+)`\s*(\([^)]+\))\s*VALUES\s*/gi;
    let match;
    while ((match = re.exec(dump)) !== null) {
        const table = match[1];
        const cols = match[2];
        let i = re.lastIndex;
        // Find end of statement (semicolon not inside string)
        let inString = false;
        let end = -1;
        for (; i < dump.length; i++) {
            const ch = dump[i];
            if (inString) {
                if (ch === '\\' && i + 1 < dump.length) {
                    i++;
                    continue;
                }
                if (ch === "'") {
                    if (i + 1 < dump.length && dump[i + 1] === "'") {
                        i++;
                        continue;
                    }
                    inString = false;
                }
                continue;
            }
            if (ch === "'") {
                inString = true;
                continue;
            }
            if (ch === ';') {
                end = i;
                break;
            }
        }
        if (end < 0) {
            throw new Error(`Unterminated INSERT for table ${table}`);
        }
        const values = dump.slice(re.lastIndex, end);
        re.lastIndex = end + 1;
        if (!byTable.has(table)) {
            byTable.set(table, []);
        }
        byTable.get(table).push({ cols, values });
    }
    return byTable;
}

function toPgInsert(table, cols, values) {
    const pgCols = cols.replace(/`/g, '"');
    const pgValues = mysqlEscapesToPostgres(values);
    return `INSERT INTO "${table}" ${pgCols} VALUES ${pgValues}`;
}

async function resetSequences(client) {
    const { rows } = await client.query(`
        SELECT
            c.relname AS table_name,
            a.attname AS column_name,
            pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
    `);

    for (const row of rows) {
        await client.query(
            `SELECT setval($1::regclass, COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1), true)`,
            [row.seq]
        );
        console.log(`  sequence ${row.seq} synced for ${row.table_name}.${row.column_name}`);
    }
}

async function main() {
    if (!fs.existsSync(SQL_PATH)) {
        throw new Error(`SQL file not found: ${SQL_PATH}`);
    }

    console.log('SQL dump:', SQL_PATH);
    const dump = fs.readFileSync(SQL_PATH, 'utf8');
    const inserts = extractInserts(dump);

    const client = dbClient();
    await client.connect();
    console.log('Connected to Supabase Postgres.');

    try {
        await dropAllPublicTables(client);
    } finally {
        await client.end();
    }

    console.log('Running Sequelize migrations...');
    execSync('npx sequelize-cli db:migrate', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: process.env,
    });

    const client2 = dbClient();
    await client2.connect();

    try {
        await client2.query('BEGIN');
        await client2.query('SET session_replication_role = replica');

        for (const table of IMPORT_ORDER) {
            const chunks = inserts.get(table) || [];
            if (!chunks.length) {
                console.log(`Skip ${table}: no data in dump`);
                continue;
            }
            for (const { cols, values } of chunks) {
                const sql = toPgInsert(table, cols, values);
                await client2.query(sql);
            }
            console.log(`Imported ${table} (${chunks.length} statement(s))`);
        }

        await client2.query('SET session_replication_role = DEFAULT');
        console.log('Resetting identity sequences...');
        await resetSequences(client2);
        await client2.query('COMMIT');

        const counts = {};
        for (const table of [
            ...IMPORT_ORDER,
            'jobs',
            'failed_jobs',
            'channel_generals',
            'sequelizemeta',
        ]) {
            try {
                const { rows } = await client2.query(
                    `SELECT COUNT(*)::int AS c FROM "${table}"`
                );
                counts[table] = rows[0].c;
            } catch {
                counts[table] = 'missing';
            }
        }
        console.log('Row counts:', counts);
    } catch (err) {
        await client2.query('ROLLBACK');
        throw err;
    } finally {
        await client2.end();
    }

    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
