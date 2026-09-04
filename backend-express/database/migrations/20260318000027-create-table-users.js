'use strict';

/**
 * Bảng `users` — Sequelize queryInterface (MySQL + Postgres).
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            user_code: {
                type: Sequelize.STRING(15),
                allowNull: false,
                unique: true
            },
            user_name: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            password: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            role: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'admin|member'
            },
            jwt_active: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            remember_token: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            status: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: '1: on, 2:off'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('users');
    }
};
