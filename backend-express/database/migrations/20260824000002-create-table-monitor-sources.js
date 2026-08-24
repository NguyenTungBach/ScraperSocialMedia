'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('monitor_sources', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            subject_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'subjects', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            platform: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'facebook',
            },
            source_type: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'page',
            },
            source_url: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            display_name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            priority: {
                type: Sequelize.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 1,
            },
            is_active: {
                type: Sequelize.TINYINT,
                allowNull: false,
                defaultValue: 1,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });

        await queryInterface.addIndex('monitor_sources', ['subject_id']);
        await queryInterface.addIndex(
            'monitor_sources',
            ['subject_id', 'platform', 'source_url'],
            { unique: true, name: 'monitor_sources_subject_platform_url_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('monitor_sources');
    },
};
