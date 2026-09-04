'use strict';

const scrapeLimits = require('../../config/scrapeLimits');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const maxPosts = scrapeLimits.maxPosts;
        const maxTopComments = scrapeLimits.maxTopComments;
        const maxReplies = scrapeLimits.maxReplies;

        await queryInterface.addColumn('channels', 'max_posts', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: maxPosts,
        });
        await queryInterface.addColumn('channels', 'max_top_comments', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: maxTopComments,
        });
        await queryInterface.addColumn('channels', 'max_replies', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: maxReplies,
        });

        await queryInterface.sequelize.query(
            `UPDATE channels SET max_posts = :maxPosts, max_top_comments = :maxTopComments, max_replies = :maxReplies`,
            {
                replacements: { maxPosts, maxTopComments, maxReplies },
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('channels', 'max_replies');
        await queryInterface.removeColumn('channels', 'max_top_comments');
        await queryInterface.removeColumn('channels', 'max_posts');
    },
};
