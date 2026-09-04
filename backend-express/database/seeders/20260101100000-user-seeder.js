'use strict';

/**
 * Seed user đăng nhập only (admin + member). Không seed bảng khác.
 * Mật khẩu plain `abc123456` — hash qua hook User.
 */
const db = require('../../app/Models');
const UserType = require('../../app/Constants/UserType');
const UserStatus = require('../../app/Constants/UserStatus');

const SEED_USERS = [
    {
        user_code: '1122',
        user_name: 'Super Admin',
        password: 'abc123456',
        role: UserType.ADMIN,
        status: UserStatus.ON
    },
    {
        user_code: '2233',
        user_name: 'Member',
        password: 'abc123456',
        role: UserType.MEMBER,
        status: UserStatus.ON
    }
];

module.exports = {
    async up() {
        for (const row of SEED_USERS) {
            const existing = await db.User.findOne({
                where: { user_code: row.user_code },
                paranoid: false
            });

            if (existing) {
                if (existing.deleted_at) {
                    await existing.restore();
                }
                existing.user_name = row.user_name;
                existing.password = row.password;
                existing.role = row.role;
                existing.status = row.status;
                await existing.save();
                continue;
            }

            await db.User.create(row);
        }
    },

    async down() {
        await db.User.destroy({
            where: { user_code: SEED_USERS.map((u) => u.user_code) },
            force: true
        });
    }
};
