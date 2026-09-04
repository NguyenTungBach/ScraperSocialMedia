'use strict';

/**
 * PM2 schedule worker — load general_schedules from DB, register node-cron,
 * spawn `npm run app:*` asynchronously (does not await command handle).
 *
 * Reload enabled rows every RELOAD_MS so FE edits apply without PM2 restart.
 */

require('dotenv').config();
const cron = require('node-cron');
const logger = require('../app/Logging/logger');
const db = require('../app/Models');
const SettingsCache = require('../app/Services/SettingsCache');
const {
    startSchedule,
    recoverInterruptedSchedules,
} = require('../app/Services/ScheduleRunner');

const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';
const RELOAD_MS = Math.max(Number(process.env.SCHEDULE_RELOAD_MS) || 60_000, 15_000);

/** @type {import('node-cron').ScheduledTask[]} */
let activeTasks = [];
let lastFingerprint = '';

function fingerprint(rows) {
    return rows
        .map((r) => `${r.id}|${r.cron_expression}|${r.command}|${r.enabled}|${r.updated_at}`)
        .join(';');
}

async function loadEnabledSchedules() {
    return db.GeneralSchedule.findAll({
        where: { enabled: true },
        order: [['id', 'ASC']],
    });
}

function stopAllTasks() {
    for (const task of activeTasks) {
        try {
            task.stop();
        } catch {
            // ignore
        }
    }
    activeTasks = [];
}

function registerSchedules(rows) {
    stopAllTasks();

    for (const row of rows) {
        const expression = String(row.cron_expression || '').trim();
        if (!cron.validate(expression)) {
            logger.error('Invalid schedule cron_expression, skip', {
                id: row.id,
                expression,
            });
            continue;
        }

        const scheduleId = Number(row.id);
        const task = cron.schedule(
            expression,
            async () => {
                try {
                    await SettingsCache.ensureLoaded();
                    const fresh = await db.GeneralSchedule.findByPk(scheduleId);
                    if (!fresh || !fresh.enabled) {
                        return;
                    }
                    await startSchedule(fresh);
                } catch (error) {
                    logger.error('Schedule tick failed', {
                        id: scheduleId,
                        error: error.message,
                        stack: error.stack,
                    });
                }
            },
            { timezone: TIMEZONE }
        );
        activeTasks.push(task);
    }

    logger.info('Schedules registered', {
        timezone: TIMEZONE,
        count: activeTasks.length,
        items: rows.map((r) => ({
            id: r.id,
            name: r.name,
            cron: r.cron_expression,
            command: r.command,
        })),
    });
}

async function reloadIfChanged() {
    const rows = await loadEnabledSchedules();
    const fp = fingerprint(rows);
    if (fp === lastFingerprint) {
        return;
    }
    lastFingerprint = fp;
    registerSchedules(rows);
}

function shutdown(signal) {
    logger.info('Scheduler worker shutting down', { signal });
    stopAllTasks();
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

(async () => {
    try {
        await db.sequelize.authenticate();
        await SettingsCache.ensureLoaded();
        await recoverInterruptedSchedules();
        await reloadIfChanged();
        setInterval(() => {
            void reloadIfChanged().catch((error) => {
                logger.error('Schedule reload failed', { error: error.message });
            });
        }, RELOAD_MS);
        logger.info('Scheduler worker started', { timezone: TIMEZONE, reloadMs: RELOAD_MS });
    } catch (error) {
        logger.error('Scheduler worker failed to start', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
})();
