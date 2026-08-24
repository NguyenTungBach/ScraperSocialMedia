const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const config = require('../../config/database.js')[env];

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        dialectOptions: config.dialectOptions,
        logging: config.logging,
        pool: config.pool,
        define: {
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at',
            freezeTableName: true,
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        }
    }
);

const db = {};

// Automatically load model files
const modelsPath = __dirname;
fs.readdirSync(modelsPath)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== 'index.js' &&
            file.slice(-3) === '.js'
        );
    })
    .forEach(file => {
        const model = require(path.join(modelsPath, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

// Set up associations between models
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

