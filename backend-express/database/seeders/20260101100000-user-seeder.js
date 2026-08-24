'use strict';

/**
 * Seed user mẫu (admin + driver).
 * Mật khẩu plain `abc12345678` — hash qua hook User.
 */
const db = require('../../app/Models');
const UserType = require('../../app/Constants/UserType');
const UserStatus = require('../../app/Constants/UserStatus');

const SEED_MARKER = '1122';

module.exports = {
    async up() {
        if (await db.User.findOne({ where: { user_code: SEED_MARKER } })) {
            return;
        }

        const users = [
            {
                user_code: '1122',
                user_name: 'Super Admin',
                password: 'abc12345678',
                role: UserType.ADMIN,
                status: UserStatus.ON
            },
            {
                user_code: '2233',
                user_name: 'Member Drive',
                password: 'abc12345678',
                role: UserType.DRIVER,
                status: UserStatus.ON
            }
        ];

        for (const row of users) {
            await db.User.create(row);
        }
    },

    async down() {
        await db.User.destroy({
            where: { user_code: ['1122', '2233'] },
            force: true
        });
    }
};
