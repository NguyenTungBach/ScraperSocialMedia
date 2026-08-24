const AuthRepository = require('../../../app/Repositories/AuthRepository');
const db = require('../../../app/Models');
const UserType = require('../../../app/Constants/UserType');
const UserStatus = require('../../../app/Constants/UserStatus');

function uniqueSuffix() {
    return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function buildUser(overrides = {}) {
    const suffix = uniqueSuffix();
    return {
        user_code: `ut${suffix}`.slice(0, 15),
        user_name: `User ${suffix}`.slice(0, 20),
        password: 'Pass1!',
        role: UserType.ADMIN,
        status: UserStatus.ON,
        ...overrides
    };
}

describe('AuthRepository', () => {
    let repository;
    let dbAvailable = false;

    beforeAll(async () => {
        try {
            await db.sequelize.authenticate();
            dbAvailable = true;
        } catch (error) {
            console.warn('Database connection failed, unit tests will be skipped');
            dbAvailable = false;
        }
    });

    beforeEach(() => {
        repository = new AuthRepository();
    });

    describe('getProfile', () => {
        it('should return null for non-existent user', async () => {
            if (!dbAvailable) {
                return;
            }
            const profile = await repository.getProfile(999999999);
            expect(profile).toBeNull();
        });

        it('should return plain user without sensitive fields', async () => {
            if (!dbAvailable) {
                return;
            }

            const user = await db.User.create(buildUser());

            try {
                const profile = await repository.getProfile(user.id);
                expect(profile).toBeTruthy();
                expect(profile.id).toBe(user.id);
                expect(profile.password).toBeUndefined();
                expect(profile.jwt_active).toBeUndefined();
                expect(profile).toHaveProperty('user_code');
            } finally {
                await db.User.destroy({ where: { id: user.id }, force: true });
            }
        });
    });

    describe('checkPassword / changePassword', () => {
        it('should verify and change password', async () => {
            if (!dbAvailable) {
                return;
            }

            const user = await db.User.create(buildUser({ password: 'OldPass1!' }));

            try {
                await user.reload();
                expect(await repository.checkPassword(user, 'OldPass1!')).toBe(true);
                const updated = await repository.changePassword(user, 'NewPass2!');
                await updated.reload();
                expect(await repository.checkPassword(updated, 'NewPass2!')).toBe(true);
            } finally {
                await db.User.destroy({ where: { id: user.id }, force: true });
            }
        });
    });

    describe('jwt_active', () => {
        it('should set and clear jwt_active', async () => {
            if (!dbAvailable) {
                return;
            }

            const user = await db.User.create(buildUser());

            try {
                await repository.setJwtActive(user, 'sample-jwt-token');
                await user.reload();
                expect(user.jwt_active).toBe('sample-jwt-token');
                await repository.clearJwtActive(user);
                await user.reload();
                expect(user.jwt_active).toBeNull();
            } finally {
                await db.User.destroy({ where: { id: user.id }, force: true });
            }
        });
    });

    describe('resetPassword / forgetPassword', () => {
        it('should return 501 for AWA schema', async () => {
            await expect(repository.forgetPassword('x')).rejects.toMatchObject({ statusCode: 501 });
        });
    });
});
