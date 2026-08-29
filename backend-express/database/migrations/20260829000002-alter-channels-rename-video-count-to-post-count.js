'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.renameColumn('channels', 'video_count', 'post_count');
    },

    async down(queryInterface) {
        await queryInterface.renameColumn('channels', 'post_count', 'video_count');
    },
};
