'use strict';

const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../Models');
const UserType = require('../Constants/UserType');
const UserStatus = require('../Constants/UserStatus');

const PUBLIC_EXCLUDE = ['password', 'remember_token', 'jwt_active'];

class UserRepository {
    constructor() {
        this.userModel = db.User;
    }

    toPublic(row) {
        const plain = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
        for (const key of PUBLIC_EXCLUDE) {
            delete plain[key];
        }
        return plain;
    }

    async listUsers({ page = 1, per_page = 20, q = null, role = null, status = null } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const where = {};

        if (role) {
            where.role = String(role).toLowerCase();
        }
        if (status != null && status !== '') {
            where.status = Number(status);
        }

        const keyword = String(q || '').trim();
        if (keyword) {
            const likeOp = db.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
            const term = `%${keyword}%`;
            where[Op.or] = [
                { user_code: { [likeOp]: term } },
                { user_name: { [likeOp]: term } },
            ];
        }

        const { rows, count } = await this.userModel.findAndCountAll({
            where,
            attributes: { exclude: PUBLIC_EXCLUDE },
            order: [['id', 'DESC']],
            limit,
            offset,
        });

        return {
            rows: rows.map((r) => this.toPublic(r)),
            count,
            page: currentPage,
            per_page: limit,
        };
    }

    async findById(id) {
        return this.userModel.findByPk(id);
    }

    async createUser(payload) {
        const code = String(payload.user_code).trim();
        const existing = await this.userModel.findOne({
            where: { user_code: code },
            paranoid: false,
        });
        if (existing) {
            throw createError(422, 'user_code already exists');
        }

        const row = await this.userModel.create({
            user_code: code,
            user_name: String(payload.user_name).trim(),
            password: String(payload.password),
            role: String(payload.role).toLowerCase(),
            status:
                payload.status != null && payload.status !== ''
                    ? Number(payload.status)
                    : UserStatus.ON,
        });

        return this.toPublic(row);
    }

    async updateUser(id, payload, { actorId } = {}) {
        const user = await this.findById(id);
        if (!user) {
            throw createError(404, 'User not found');
        }

        if (payload.user_code != null) {
            const code = String(payload.user_code).trim();
            if (code !== user.user_code) {
                const clash = await this.userModel.findOne({
                    where: { user_code: code, id: { [Op.ne]: id } },
                    paranoid: false,
                });
                if (clash) {
                    throw createError(422, 'user_code already exists');
                }
                user.user_code = code;
            }
        }

        if (payload.user_name != null) {
            user.user_name = String(payload.user_name).trim();
        }

        if (payload.password != null && String(payload.password).trim() !== '') {
            user.password = String(payload.password);
        }

        if (payload.role != null) {
            const nextRole = String(payload.role).toLowerCase();
            if (
                Number(actorId) === Number(id) &&
                UserType.isAdmin(user.role) &&
                !UserType.isAdmin(nextRole)
            ) {
                throw createError(422, 'Cannot demote your own admin account');
            }
            user.role = nextRole;
        }

        if (payload.status != null && payload.status !== '') {
            const nextStatus = Number(payload.status);
            if (
                Number(actorId) === Number(id) &&
                nextStatus === UserStatus.OFF
            ) {
                throw createError(422, 'Cannot disable your own account');
            }
            user.status = nextStatus;
        }

        await user.save();
        return this.toPublic(user);
    }

    async deleteUser(id, { actorId } = {}) {
        if (Number(actorId) === Number(id)) {
            throw createError(422, 'Cannot delete your own account');
        }

        const user = await this.findById(id);
        if (!user) {
            throw createError(404, 'User not found');
        }

        await user.destroy();
        return { id: Number(id), deleted: true };
    }
}

module.exports = UserRepository;
