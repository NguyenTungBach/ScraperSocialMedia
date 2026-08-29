'use strict';

/**
 * Ngưỡng gắn nhãn uptrend / downtrend / flat cho mail báo cáo so sánh.
 * % thay đổi giữa mốc đầu và cuối trong khoảng ngày đã chọn.
 */
function pct(name, fallback) {
    const n = Number(process.env[name]);
    return Number.isFinite(n) ? n : fallback;
}

module.exports = {
    /** Delta % >= ngưỡng → uptrend */
    uptrendPct: pct('COMPARE_UPTREND_PCT', 5),
    /** Delta % <= ngưỡng (âm) → downtrend */
    downtrendPct: pct('COMPARE_DOWNTREND_PCT', -5),
};
