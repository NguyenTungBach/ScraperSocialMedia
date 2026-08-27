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

const COMMENT_ANALYSIS_PROMPT = `Bạn là AI phân tích comment YouTube. Nhiệm vụ: phân tích danh sách comment và reply của MỘT video.

INPUT: JSON gồm video + comments (comment_id, parent_id, author, text).

BƯỚC 1 — NHÓM CẤU TRÚC
- lone: comment không reply ai và không ai reply
- thread: gốc có reply hoặc comment có parent_id (giữ cây hội thoại)

BƯỚC 2 — PHÂN LOẠI
Lone:
- negative: tiêu cực, công kích, khiêu khích, gây war (KHÔNG coi bất đồng quan điểm đơn thuần là tiêu cực)
- normal: bình thường, không đáng chú ý

Thread (đọc CẢ chuỗi trước khi kết luận, không đánh giá reply riêng lẻ):
- negative: chuỗi tiêu cực/gây war
- debate: tranh luận/tranh cãi (ưu tiên debate nếu vừa tiêu cực vừa tranh luận)
- has_negativity: true nếu debate nhưng vẫn có yếu tố tiêu cực

Mỗi lone/thread được chọn thêm:
- sentiment: positive | neutral | negative | unknown
- category: opinion | attack | provoke | debate | argument | normal | other | unknown
- severity: low | medium | high | unknown
- reason: giải thích ngắn 1-2 câu bằng tiếng Việt

QUY TẮC:
- Không sửa text comment
- Không suy diễn nội dung không có
- Mỗi comment_id chỉ xuất hiện một lần
- Không chắc → classified_as hoặc category = unknown
- Giữ thứ tự comment trong thread
- Trả về TẤT CẢ comment lone (negative + normal). Chỉ trả thread có ý nghĩa (negative/debate/unknown nếu không chắc)

OUTPUT: JSON thuần theo schema, không markdown.`;

const CONTENT_BRIEF_PROMPT = `Bạn tóm tắt nội dung video/bài đăng mạng xã hội.

INPUT: JSON gồm title, text (mô tả), post_url (optional).

NHIỆM VỤ — field "brief":
- Viết 1–2 câu tiếng Việt, cực ngắn gọn.
- Nêu video/bài đề cập vấn đề, chủ đề, sự kiện gì (ưu tiên an ninh trật tự / dư luận VN nếu có).
- Chỉ dựa trên title/text; không bịa thêm.
- Không chắc → brief = "Không đủ thông tin".

QUY TẮC OUTPUT (BẮT BUỘC):
- Trả về DUY NHẤT một chuỗi JSON thuần hợp lệ.
- Bắt đầu bằng { và kết thúc bằng }.
- KHÔNG thêm lời dẫn, KHÔNG giải thích, KHÔNG bình luận trước/sau JSON.
- KHÔNG dùng markdown, KHÔNG dùng code block (không dùng dấu \`\`\`).
- KHÔNG bọc JSON trong text tự do — chỉ JSON object.

Định dạng mẫu bắt buộc:
{"brief":"Video bàn về ..."}`;

function parseModelList(value) {
    return String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const fallbackModels = parseModelList(
    process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite'
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
    commentAnalysisPrompt: COMMENT_ANALYSIS_PROMPT,
    contentBriefPrompt: CONTENT_BRIEF_PROMPT,
    alertTopVideosPerSubject: Number(process.env.ALERT_TOP_VIDEOS_PER_SUBJECT) || 10,
};
