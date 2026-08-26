'use strict';

/**
 * Quote identifiers theo dialect hiện tại (MySQL/MariaDB: `, Postgres: ").
 * Tránh hard-code backtick / double-quote trong raw SQL.
 */
function quoteIdent(sequelize, identifier) {
    const qi = sequelize.getQueryInterface().queryGenerator;
    return qi.quoteIdentifier(identifier);
}

/** `alias`.`column` hoặc "alias"."column" tùy dialect. */
function qualifyCol(sequelize, alias, column) {
    return `${quoteIdent(sequelize, alias)}.${quoteIdent(sequelize, column)}`;
}

module.exports = {
    qualifyCol,
    quoteIdent,
};
