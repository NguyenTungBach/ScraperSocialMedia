'use strict';

const logger = require('../Logging/logger');

/**
 * Sample queue job — chỉ ghi log (dùng để thử queue worker).
 * Dispatch: `Job.dispatch('SampleLogJob', { message: 'hello' })`
 */
class SampleLogJob {
    /**
     * @param {{ message?: string }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    async handle() {
        logger.info('[sample] SampleLogJob', { message: this.data?.message || null });
        return { ok: true, sample: true };
    }
}

module.exports = SampleLogJob;
