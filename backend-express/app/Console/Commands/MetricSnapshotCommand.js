'use strict';

const MetricSnapshotService = require('../../Services/MetricSnapshotService');
const logger = require('../../Logging/logger');

/**
 * Snapshot metrics hàng ngày — GitHub Actions mỗi 5h / chạy tay.
 * Chạy: npm run app:metric-snapshot
 * Env tuỳ chọn: SNAPSHOT_FORCE=false để không ghi đè (mặc định force=true trên cron)
 */
class MetricSnapshotCommand {
    static signature = 'app:metric-snapshot';

    static scheduleEnabled = false;

    async handle() {
        const forceEnv = String(process.env.SNAPSHOT_FORCE || 'true').toLowerCase();
        const force = forceEnv !== 'false' && forceEnv !== '0';
        const snapshot_date = String(process.env.SNAPSHOT_DATE || '').trim() || undefined;

        const service = new MetricSnapshotService();
        const result = await service.run({ force, snapshot_date });

        logger.info('[snapshot] Metric snapshot finished', result);
        return result;
    }
}

module.exports = MetricSnapshotCommand;
