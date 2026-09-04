'use strict';

/**
 * Rename legacy role `driver` → `member`.
 * Cập nhật ghi chú cột `users.role`: admin|driver → admin|member.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `UPDATE users SET role = 'member' WHERE role = 'driver'`
        );
        await queryInterface.changeColumn('users', 'role', {
            type: Sequelize.STRING(255),
            allowNull: false,
            comment: 'admin|member',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `UPDATE users SET role = 'driver' WHERE role = 'member'`
        );
        await queryInterface.changeColumn('users', 'role', {
            type: Sequelize.STRING(255),
            allowNull: false,
            comment: 'admin|driver',
        });
    },
};
