'use strict';

require('dotenv').config();

const DISCOVER_SUBJECTS_PROMPT = `Tôi muốn xuất ra danh sách người nổi tiếng, giang hồ mạng, phát ngôn gây bão nhưng tai tiếng tại Việt Nam trong khoảng 4 tháng gần đây hoặc mới có.
Chủ đề liên quan đến an ninh trật tự, ở Việt Nam.
Lưu ý chỉ cần tên thôi.

Yêu cầu bắt buộc:
- Tối đa tầm 10 tên (ưu tiên đang bàn tán nhất trên MXH: Facebook, TikTok, YouTube VN).
- Mỗi phần tử là object: "name" = họ tên thật, "nick_name" = biệt danh phổ biến (không có thì để chuỗi rỗng "").
- KHÔNG gộp dạng "Họ tên (Biệt danh)" trong một field.
- KHÔNG giải thích, KHÔNG mô tả lý do, KHÔNG dùng markdown code block (không dùng dấu \`\`\`).
- Dữ liệu trả ra DUY NHẤT là một chuỗi JSON thuần hợp lệ, bắt đầu bằng dấu { và kết thúc bằng dấu }.

Định dạng mẫu bắt buộc:
{"data":[{"name":"Tên 1","nick_name":"Biệt danh 1"},{"name":"Tên 2","nick_name":"Biệt danh 2"}]}`;

function parseModelList(value) {
    return String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const fallbackModels = parseModelList(
    process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.0-flash,gemini-2.5-flash-lite,gemini-1.5-flash'
).filter((m) => m !== primaryModel);

module.exports = {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: primaryModel,
    /** Thử lần lượt khi primary bị high demand / 429 / 503 */
    fallbackModels,
    maxRetries: Number(process.env.GEMINI_MAX_RETRIES) || 2,
    retryDelayMs: Number(process.env.GEMINI_RETRY_DELAY_MS) || 1200,
    enabled: process.env.GEMINI_ENABLED === 'true',
    alertTrendThreshold: Number(process.env.ALERT_TREND_THRESHOLD) || 500,
    alertHotThreshold: Number(process.env.ALERT_HOT_THRESHOLD) || 800,
    discoverSubjectsPrompt: DISCOVER_SUBJECTS_PROMPT,
};
