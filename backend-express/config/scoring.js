'use strict';

/**
 * Điểm hot/trend mặc định theo tháng lịch hiện tại (posted_at).
 * VD: hôm nay 26/08/2026 → [2026-08-01, 2026-09-01).
 * Bộ lọc API dùng date_from / date_to (YYYY-MM-DD) để ghi đè cửa sổ này.
 */

module.exports = {
    mode: 'calendar_month',
};
