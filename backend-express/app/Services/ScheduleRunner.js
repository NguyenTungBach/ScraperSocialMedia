'use strict';

const { spawn } = require('child_process');
const path = require('path');
const db = require('../Models');
const logger = require('../Logging/logger');
const ScheduleStatus = require('../Constants/ScheduleStatus');
const { validateAllowedCommand } = require('../Helpers/ScheduleCommandHelper');

const BACKEND_ROOT = path.join(__dirname, '../..');

/** @type {Set<number>} */
const runningIds = new Set();

/**
 * Spawn schedule command without blocking the caller.
 * Updates last_status on start/exit.
 *
 * @param {import('sequelize').Model} schedule
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ started: boolean, reason?: string, schedule: object }>}
 */
async function startSchedule(schedule, options = {}) {
    const id = Number(schedule.id);
    const force = Boolean(options.force);

    const validated = validateAllowedCommand(schedule.command);
    if (!validated.ok) {
        await schedule.update({
            last_status: ScheduleStatus.FAILED,
            last_error: validated.message,
            last_finished_at: new Date(),
        });
        return { started: false, reason: validated.message, schedule: schedule.toJSON() };
    }

    if (!force && (runningIds.has(id) || schedule.last_status === ScheduleStatus.RUNNING)) {
        logger.warn('Schedule already running, skip', { id, command: schedule.command });
        return { started: false, reason: 'already_running', schedule: schedule.toJSON() };
    }

    runningIds.add(id);
    const startedAt = new Date();
    await schedule.update({
        last_status: ScheduleStatus.RUNNING,
        last_run_at: startedAt,
        last_error: null,
    });

    logger.info('Schedule spawn start', {
        id,
        name: schedule.name,
        command: validated.command,
    });

    let child;
    try {
        child = spawn(validated.command, {
            shell: true,
            cwd: BACKEND_ROOT,
            env: process.env,
            stdio: ['ignore', 'inherit', 'inherit'],
            windowsHide: true,
        });
    } catch (error) {
        runningIds.delete(id);
        await schedule.update({
            last_status: ScheduleStatus.FAILED,
            last_error: error.message || String(error),
            last_finished_at: new Date(),
        });
        logger.error('Schedule spawn failed', { id, error: error.message });
        return { started: false, reason: error.message, schedule: await reloadPlain(id) };
    }

    child.on('error', async (error) => {
        runningIds.delete(id);
        try {
            await db.GeneralSchedule.update(
                {
                    last_status: ScheduleStatus.FAILED,
                    last_error: error.message || String(error),
                    last_finished_at: new Date(),
                },
                { where: { id } }
            );
        } catch (dbErr) {
            logger.error('Failed to update schedule after spawn error', {
                id,
                error: dbErr.message,
            });
        }
        logger.error('Schedule process error', { id, error: error.message });
    });

    child.on('exit', async (code, signal) => {
        runningIds.delete(id);
        const ok = code === 0;
        const last_error = ok
            ? null
            : `Process exited with code ${code}${signal ? ` signal ${signal}` : ''}`;
        try {
            await db.GeneralSchedule.update(
                {
                    last_status: ok ? ScheduleStatus.SUCCESS : ScheduleStatus.FAILED,
                    last_error,
                    last_finished_at: new Date(),
                },
                { where: { id } }
            );
        } catch (dbErr) {
            logger.error('Failed to update schedule after exit', { id, error: dbErr.message });
        }
        logger.info('Schedule spawn finished', {
            id,
            command: validated.command,
            code,
            signal,
            ok,
        });
    });

    return { started: true, schedule: schedule.toJSON() };
}

async function reloadPlain(id) {
    const row = await db.GeneralSchedule.findByPk(id);
    return row ? row.toJSON() : null;
}

/**
 * Mark rows stuck in running (e.g. after scheduler crash) as failed.
 */
async function recoverInterruptedSchedules() {
    const [count] = await db.GeneralSchedule.update(
        {
            last_status: ScheduleStatus.FAILED,
            last_error: 'Interrupted (scheduler restarted while running)',
            last_finished_at: new Date(),
        },
        { where: { last_status: ScheduleStatus.RUNNING } }
    );
    if (count > 0) {
        logger.warn('Recovered interrupted schedules', { count });
    }
    runningIds.clear();
}

function isRunningInProcess(id) {
    return runningIds.has(Number(id));
}

module.exports = {
    startSchedule,
    recoverInterruptedSchedules,
    isRunningInProcess,
    BACKEND_ROOT,
};
