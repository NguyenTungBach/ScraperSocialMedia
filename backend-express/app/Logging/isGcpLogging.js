'use strict';

/**
 * Nhánh log cho GCP (Cloud Run / Cloud Logging): JSON ra stdout, không phụ thuộc file trên disk.
 *
 * Bật khi:
 *   - GCP_LOG=1 | true | yes
 *   - hoặc biến môi trường K_SERVICE có giá trị (Cloud Run tự set)
 *
 * Tắt trên Cloud Run (vẫn dùng kiểu file/console cũ): GCP_LOG=0 | false | no
 */
function isGcpLogging() {
    const v = process.env.GCP_LOG;
    if (v === '0' || v === 'false' || v === 'no') {
        return false;
    }
    if (v === '1' || v === 'true' || v === 'yes') {
        return true;
    }
    return Boolean(process.env.K_SERVICE);
}

module.exports = { isGcpLogging };
