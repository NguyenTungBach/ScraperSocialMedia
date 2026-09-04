'use strict';

const logger = require('../../Logging/logger');

/**
 * Sample scheduled command.
 * Chạy thủ công: `npm run app:sample-ping`
 * Cron: bật `scheduleEnabled = true` (hoặc set SCHEDULE_CHECK=true để chạy mỗi phút khi test).
 */
class SamplePingCommand {
    static signature = 'app:sample-ping';

    /** Lịch chạy qua bảng general_schedules + PM2 scheduler (spawn), không hardcode ở đây. */
    static scheduleEnabled = false;

    static get schedule() {
        if (String(process.env.SCHEDULE_CHECK || '').toLowerCase() === 'true') {
            return '* * * * *';
        }
        return '0 * * * *';
    }

    async handle() {
        logger.info('[sample] SamplePingCommand tick', {
            at: new Date().toISOString()
        });
        return { ok: true, sample: true };
    }
}

module.exports = SamplePingCommand;
