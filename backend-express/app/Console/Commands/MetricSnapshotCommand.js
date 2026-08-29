'use strict';

const MetricSnapshotService = require('../../Services/MetricSnapshotService');
const logger = require('../../Logging/logger');

/**
 * Snapshot metrics hàng ngày — GitHub Actions mỗi 5h / chạy tay.
 * Chạy: npm run app:metric-snapshot
 * Luôn ghi đè nếu đã có snapshot ngày hôm nay.
 */
class MetricSnapshotCommand {
    static signature = 'app:metric-snapshot';

    static scheduleEnabled = false;

    async handle() {
        const snapshot_date = String(process.env.SNAPSHOT_DATE || '').trim() || undefined;

        const service = new MetricSnapshotService();
        const result = await service.run({ force: true, snapshot_date });

        logger.info('[snapshot] Metric snapshot finished', result);
        return result;
    }
}

module.exports = MetricSnapshotCommand;
