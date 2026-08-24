require('dotenv').config();

function isTruthy(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parseDatabaseUrl(value) {
    if (!value) {
        return {};
    }

    const parsed = new URL(value);

    return {
        username: decodeURIComponent(parsed.username),
        password: parsed.password ? decodeURIComponent(parsed.password) : null,
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
        host: parsed.hostname,
        port: parsed.port || 3306,
        dialect: parsed.protocol.replace(/:$/, '') || 'mysql',
        ssl: isTruthy(parsed.searchParams.get('ssl'))
    };
}

function dialectOptions(useSsl = false) {
    return {
        charset: 'utf8mb4',
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
    };
}

const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
const productionSsl = isTruthy(process.env.DB_SSL) || databaseUrl.ssl;

/** Sequelize-cli migration history table — lowercase for MySQL + Postgres parity. */
const sequelizeCliStorage = {
    migrationStorageTableName: 'sequelizemeta'
};

module.exports = {
    development: {
        username: process.env.DB_USERNAME || 'atmtc_user',
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : null,
        database: process.env.DB_DATABASE || 'atmtc_db',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3308,
        dialect: process.env.DB_CONNECTION || 'mysql',
        dialectOptions: dialectOptions(isTruthy(process.env.DB_SSL)),
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        ...sequelizeCliStorage,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    test: {
        username: process.env.DB_USERNAME || 'atmtc_user',
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : null,
        database: process.env.DB_NAME_TEST || 'atmtc_db_test',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3308,
        dialect: 'mysql',
        dialectOptions: dialectOptions(isTruthy(process.env.DB_SSL)),
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        ...sequelizeCliStorage,
        logging: false
    },
    production: {
        username: process.env.DB_USERNAME || databaseUrl.username,
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : databaseUrl.password,
        database: process.env.DB_DATABASE || databaseUrl.database,
        host: process.env.DB_HOST || databaseUrl.host,
        port: process.env.DB_PORT || databaseUrl.port || 3306,
        dialect: process.env.DB_CONNECTION || databaseUrl.dialect || 'mysql',
        dialectOptions: dialectOptions(productionSsl),
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        ...sequelizeCliStorage,
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
};

