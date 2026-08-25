'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('social_posts', {
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
            likes: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            angry_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            comments: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            shares: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            trend_score: {
                type: Sequelize.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
            },
            hot_score: {
                type: Sequelize.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
            },
            posts_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            computed_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        await queryInterface.addIndex(
            'social_posts',
            ['subject_id'],
            { unique: true, name: 'social_posts_subject_id_unique' }
        );
        await queryInterface.addIndex('social_posts', ['hot_score']);
        await queryInterface.addIndex('social_posts', ['trend_score']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('social_posts');
    },
};
