'use strict';

const createError = require('http-errors');
const cron = require('node-cron');
const { Op } = require('sequelize');
const db = require('../Models');
const ScheduleStatus = require('../Constants/ScheduleStatus');
const {
    listAllowedCommands,
    validateAllowedCommand,
} = require('../Helpers/ScheduleCommandHelper');
const { startSchedule } = require('./ScheduleRunner');

class GeneralScheduleService {
    toPublic(row) {
        return typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
    }

    async list({ page = 1, per_page = 50, q = null, enabled = null } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 50, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const where = {};

        if (enabled != null && enabled !== '') {
            where.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1 || enabled === '1');
        }

        const keyword = String(q || '').trim();
        if (keyword) {
            const likeOp = db.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
            const term = `%${keyword}%`;
            where[Op.or] = [
                { name: { [likeOp]: term } },
                { command: { [likeOp]: term } },
                { cron_expression: { [likeOp]: term } },
            ];
        }

        const { rows, count } = await db.GeneralSchedule.findAndCountAll({
            where,
            order: [
                ['enabled', 'DESC'],
                ['id', 'ASC'],
            ],
            limit,
            offset,
        });

        return {
            rows: rows.map((r) => this.toPublic(r)),
            count,
            page: currentPage,
            per_page: limit,
            allowed_commands: listAllowedCommands(),
        };
    }

    async create(payload) {
        const commandCheck = validateAllowedCommand(payload.command);
        if (!commandCheck.ok) {
            throw createError(422, commandCheck.message);
        }
        if (!cron.validate(String(payload.cron_expression || '').trim())) {
            throw createError(422, 'Invalid cron_expression');
        }

        const row = await db.GeneralSchedule.create({
            name: String(payload.name).trim(),
            cron_expression: String(payload.cron_expression).trim(),
            command: commandCheck.command,
            enabled: payload.enabled !== false && payload.enabled !== 0 && payload.enabled !== '0',
            last_status: ScheduleStatus.IDLE,
        });
        return this.toPublic(row);
    }

    async update(id, payload) {
        const row = await db.GeneralSchedule.findByPk(id);
        if (!row) {
            throw createError(404, 'Schedule not found');
        }

        const next = {};
        if (payload.name != null) {
            next.name = String(payload.name).trim();
        }
        if (payload.cron_expression != null) {
            const expr = String(payload.cron_expression).trim();
            if (!cron.validate(expr)) {
                throw createError(422, 'Invalid cron_expression');
            }
            next.cron_expression = expr;
        }
        if (payload.command != null) {
            const commandCheck = validateAllowedCommand(payload.command);
            if (!commandCheck.ok) {
                throw createError(422, commandCheck.message);
            }
            next.command = commandCheck.command;
        }
        if (payload.enabled != null) {
            next.enabled =
                payload.enabled === true ||
                payload.enabled === 1 ||
                payload.enabled === '1' ||
                payload.enabled === 'true';
        }

        if (Object.keys(next).length === 0) {
            throw createError(422, 'At least one field is required');
        }

        await row.update(next);
        return this.toPublic(row);
    }

    async destroy(id) {
        const row = await db.GeneralSchedule.findByPk(id);
        if (!row) {
            throw createError(404, 'Schedule not found');
        }
        if (row.last_status === ScheduleStatus.RUNNING) {
            throw createError(422, 'Cannot delete a running schedule');
        }
        await row.destroy();
        return { id: Number(id), deleted: true };
    }

    async runNow(id) {
        const row = await db.GeneralSchedule.findByPk(id);
        if (!row) {
            throw createError(404, 'Schedule not found');
        }
        const result = await startSchedule(row, { force: false });
        if (!result.started && result.reason === 'already_running') {
            throw createError(422, 'Schedule is already running');
        }
        if (!result.started) {
            throw createError(422, result.reason || 'Failed to start schedule');
        }
        return result.schedule;
    }

    allowedCommands() {
        return listAllowedCommands();
    }
}

module.exports = GeneralScheduleService;
