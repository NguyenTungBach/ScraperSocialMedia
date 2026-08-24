'use strict';

/**
 * Base Job class
 * Match Laravel style: dispatch through QueueService.
 */
class Job {
    /**
     * @param {string} jobClass
     * @param {Record<string, unknown>} data
     */
    static async dispatch(jobClass, data = {}) {
        const QueueService = require('../Services/QueueService');
        return await QueueService.dispatch(jobClass, data);
    }
}

module.exports = Job;
