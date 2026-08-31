# ScraperSocialMedia

Hệ thống **theo dõi & phân tích nội dung mạng xã hội** (Facebook, YouTube, TikTok): cào bài + comment → lưu DB → tính chỉ số hot/trend & engagement → AI phân tích → cảnh báo mail khi vượt ngưỡng.

**Stack:** Backend Express (MySQL/Sequelize) · Frontend Next.js · Apify (FB/TikTok) · YouTube Data API · Gemini · SMTP/Gmail.

---

## Định hướng

| Giai đoạn | Mục tiêu |
|-----------|----------|
| **Hiện tại (demo)** | Chạy trên hạ tầng free (Render, Aiven MySQL, Apify free, Gemini cá nhân, YouTube API). Cào bài mới theo kênh, tổng hợp score, UI quản lý, alert/AI (alert tạm dừng dùng). |
| **Mục tiêu vận hành** | Cào hàng ngày ổn định; chi phí cloud/API do bên vận hành trả; server production riêng (không phụ thuộc tài khoản free cá nhân). |
| **Định hướng tiếp** | So sánh cùng một “kênh/brand” trên 3 MXH (engagement từ `scraper_runs` + followers từ `channels`); thống kê; AI đánh giá nền tảng nào đang phát triển hơn, comment tích cực/tiêu cực. |

### Luồng nghiệp vụ (hiện tại)

```
[Channels] ──scrape──► scraper_runs (metrics bài) + channels.followers
                              │
                              ├─ match subject (name / normalized_name / subject_channels)
                              │         ↓
                              │   subjects_scraper_runs
                              │         ↓
                              │   social_posts (1 row / subject):
                              │     · engagement = SUM metrics bài (theo cửa sổ)
                              │     · follow = SUM(channels.followers) qua subject_channels
                              │
                              └─ Gemini: content_brief + phân tích comment (chunk 10/lần)
                                        ↓ (khi hot hoặc trend ≥ ngưỡng — luồng alert)
                                   Gmail alert (+ AI top bài/subject)
```

---

## Tính năng

### Đã có

| Nhóm | Chi tiết |
|------|----------|
| **Cào dữ liệu** | Facebook (Apify), YouTube (Data API v3), TikTok (Apify). Mặc định: **10 bài mới** / lần, **30 comment** / bài, **10 reply**. Bài cũ chưa bắt buộc cập nhật định kỳ (có API refresh tail YouTube nếu cần). |
| **Chỉ số** | **Bài** (`scraper_runs`): likes, comments, shares, angry, views (`follow` cột luôn 0, không dùng). **Kênh** (`channels.followers`): page likes / YT subscribers / TT fans. **Subject** (`social_posts`): SUM engagement bài + `follow` = SUM followers kênh gắn. Tính **hot_score**, **trend_score**; suy ra Thảo luận / Tương tác / Cảm xúc (công thức bên dưới). |
| **Đối tượng & kênh** | CRUD `subjects`, `channels`; gắn N–N subject ↔ channel; discover subject qua Gemini. |
| **Comment + AI** | Lưu comment/thread; Gemini gắn sentiment, category, severity, reason; **content brief** cho bài. Phân tích theo **chunk 10 comment gốc (hoặc 1 thread)/lần** gọi Gemini. Tự chạy sau scrape; nút **Phân tích comment** trên UI (FB/YT/TT). FE: danh sách comment + bảng phân tích **10 mục/trang**. |
| **Snapshot metrics** | 3 bảng ngày: `channel_daily_snapshots`, `post_daily_snapshots` (kèm hot/trend), `post_top_comments_daily`. Chỉ kênh ∈ `subject_channels`. CLI `npm run app:metric-snapshot`; GH Action mỗi 5h; FE nút Snapshot + xem thống kê kênh. |
| **So sánh + mail** | UI so sánh nhiều kênh/bài theo khoảng ngày (snapshot); gửi báo cáo mail (`POST /reports/compare-email`) — tách khỏi alert hot/trend. |
| **Alert** | `POST /api/alerts/gmail`: mail khi bài vượt ngưỡng **hot hoặc trend** (trong tháng hiện tại); trước khi gửi chạy AI **top N bài hot/subject** (mặc định 3). CLI `npm run app:alert-gmail`. |
| **Hệ thống** | Auth đăng nhập; BE API (tìm kiếm, paginate, CRUD); FE (home, subjects, channels); queue/jobs; migrate DB. |

### Đang / sẽ làm

| Nhóm | Chi tiết |
|------|----------|
| **Đang / sẽ làm** | So sánh đa đối tượng + mail báo cáo so sánh; nút AI comment đủ 3 MXH; production cron ổn định. |
| **Snapshot (đã làm nền)** | Bảng ngày + cron 5h + FE Snapshot / thống kê kênh. |

### Công thức điểm

`viewWeight = floor(views / 100)`. Tính theo **từng platform** rồi cộng (aggregate theo subject):

| Platform | `trend_score` | `hot_score` |
|----------|---------------|-------------|
| **Facebook** | likes×1 + comments×2 + shares×3 | likes×1 + comments×2 + shares×3 + angry×4 |
| **YouTube** | likes×1 + comments×2 + viewWeight×3 | likes×1 + comments×3 + viewWeight×3 |
| **TikTok** | likes×1 + comments×2 + shares×3 + viewWeight×2 | likes×1 + comments×3 + shares×3 + viewWeight×2 |

**Không** dùng `follow` / `channels.followers` trong hot/trend.

Chỉ số phụ (derive lúc API, không lưu riêng trên `social_posts` trừ `follow`):

| Chỉ số | Cách lấy |
|--------|----------|
| **Thảo luận** | `comments + posts_count` |
| **Tương tác** | YT: `likes + comments` · FB/TT: `likes + comments + shares` |
| **Cảm xúc** | FB: `(likes - angry) / (likes + angry)` · YT/TT: `0` |
| **Followers (subject)** | `SUM(channels.followers)` qua `subject_channels` — **không** lấy từ `scraper_runs` |
| **Views (bài)** | YT: `statistics.viewCount` · TT: `playCount` · FB: `viewsCount` / `views` / `viewCount` / … (post thường thường 0) |

**Followers theo nền tảng (lưu `channels.followers` lúc scrape):**

| Platform | Nguồn |
|----------|--------|
| Facebook | Page profile (`followers` / `likes`) |
| YouTube | `channels.list` → `statistics.subscriberCount` (không có trong `scraper_runs.raw_data` video) |
| TikTok | `authorMeta.fans` (có trong payload video / `scraper_runs.raw_data`, nhưng ghi vào kênh) |

Ngưỡng alert mặc định: `ALERT_HOT_THRESHOLD`, `ALERT_TREND_THRESHOLD` (`.env`) — bài vượt **một trong hai** ngưỡng là candidate.
Top bài AI trong mail alert: `ALERT_TOP_POSTS_PER_SUBJECT` (alias `ALERT_TOP_VIDEOS_PER_SUBJECT`, mặc định **3** bài hot nhất / subject).
Chunk phân tích comment: `GEMINI_COMMENT_ANALYSIS_CHUNK_SIZE` (mặc định **10**).
Ngưỡng nhãn up/down mail so sánh: `COMPARE_UPTREND_PCT`, `COMPARE_DOWNTREND_PCT` (mặc định 5 / -5).

---

## Luồng Alert Gmail (`POST /api/alerts/gmail`)

```
1. listAlertPosts
   · Bài FB/YT/TT có link subject (subjects_scraper_runs)
   · posted_at trong tháng lịch hiện tại
   · hot_score >= ALERT_HOT_THRESHOLD  HOẶC  trend_score >= ALERT_TREND_THRESHOLD
   · (tuỳ chọn) lọc subject_id nếu body có subject_id

2. Nếu không có candidate → { sent: false, reason: "no_candidates_over_threshold" }

3. Nhóm bài theo subject → mỗi subject lấy top N bài theo hot_score (ALERT_TOP_POSTS_PER_SUBJECT)

4. Với từng bài trong top N:
   · content_brief (Gemini) nếu chưa có
   · phân tích comment pending / thiếu kết quả (Gemini, chunk 10 đơn vị/lần)

5. buildAlertEmail → gửi SMTP/SES tới MAIL_MAIN (hoặc body.to)
   · BCC: MAIL_ALERT_BCC + body.bcc (dedupe, bỏ trùng người nhận chính)
```

**Lưu ý:** Ngưỡng là **OR** (hot **hoặc** trend), không yêu cầu cả hai cùng vượt. Mail liệt kê **tất cả** candidate vượt ngưỡng; phần AI comment trong mail chỉ chạy trên **top N bài hot/subject**.

---

## API Comment & phân tích AI

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/comments?scraper_run_id=` | Comment đã lưu (lone + threads) + `meta` (số đã phân loại / còn thiếu) |
| POST | `/api/comments/analyze` | AI 1 bài: `{ "scraper_run_id": 123 }` |

### `POST /api/comments/analyze`

**Luồng:**

1. **Content brief** — nếu `content_brief_status` chưa `done`/`skipped`: Gemini tóm tắt title/text bài.
2. **Comment analysis** — chỉ comment cần xử lý:
   - `analysis_status = pending`, hoặc
   - `done` nhưng **thiếu** `classified_as` và `reason` (kết quả cũ bị cắt / lỗi).
3. Nhóm thành **đơn vị**: 1 comment lone hoặc 1 thread (giữ nguyên cả chuỗi reply).
4. Chia chunk tối đa **10 đơn vị** → gọi Gemini từng chunk → lưu kết quả từng comment/thread.
5. Thread đã gửi nhưng Gemini không trả (thường bình thường) → đánh dấu `done` ở bước finalize.
6. Comment lone **không** có trong response Gemini → **không** bị ép `done` (giữ pending để chạy lại).

**Response (rút gọn):**

```json
{
  "scraper_run_id": 210,
  "content_brief": { "analyzed": true, "content_brief": "..." },
  "comments_analysis": {
    "analyzed": true,
    "chunks_processed": 8,
    "comments_sent": 76,
    "model": "gemini-3.6-flash"
  },
  "comments": { "lone": [], "threads": [], "meta": { "analyzed_lone_count": 11, "pending_lone_count": 65 } }
}
```

**`comments_analysis.reason` thường gặp:** `already_done` · `no_comments` · `gemini_disabled` · `not_found`

**Tự động sau scrape:** FB / YT / TT gọi `analyzePostAfterScrape` — lỗi Gemini không làm fail luồng cào.

**FE:** panel comment và modal «Xem bảng phân tích chi tiết» phân trang **10 mục/trang** (client-side).

---

## Database (`scraper_social_media`)

### Sơ đồ quan hệ (rút gọn)

```
users
channels ◄── subject_channels ──► subjects ◄── social_posts (1:1 subject)
   │                                  │
   │                                  └── subjects_scraper_runs ──┐
   └──────────────────────────────► scraper_runs ◄────────────────┘
                                         │
                         ┌───────────────┼───────────────┐
                         ▼               ▼               ▼
                  post_comments   comment_threads   (content_brief trên run)

jobs / failed_jobs  (queue)
```

### Bảng nghiệp vụ

| Bảng | Mô tả | Trường chính |
|------|--------|--------------|
| `subjects` | Đối tượng theo dõi (người/chủ đề) | `name`, `normalized_name`, `item_type`, `status`, `source` |
| `channels` | Catalog kênh MXH | `name`, `url`, `type_channel` (`facebook` \| `youtube` \| `tiktok`), `followers`, `post_count`, `raw_data` |
| `subject_channels` | N–N subject ↔ channel | `subject_id`, `channel_id` |
| `scraper_runs` | **1 dòng = 1 bài/video** | `platform`, `platform_post_id`, `post_url`, `title`, `text`, `likes`, `comments`, `shares`, `angry_count`, `views`, `follow` (luôn 0), `posted_at`, `scraped_at`, `channel_id`, `raw_data`, `content_brief*` |
| `subjects_scraper_runs` | N–N subject ↔ bài khớp | `subject_id`, `scraper_run_id` |
| `social_posts` | **Cache 1 row / subject** (tháng lịch hiện tại) | engagement SUM từ bài; `follow` = SUM `channels.followers` qua `subject_channels`; `trend_score`, `hot_score`, `posts_count`, `computed_at` |
| `post_comments` | Comment (kèm reply) theo bài | `scraper_run_id`, `platform_comment_id`, `parent_…`, `thread_key`, `author`, `text`, `like_count`, `group_type`, `sentiment`, `category`, `severity`, `analysis_status`, `raw_data` |
| `comment_threads` | Thread comment + kết quả AI | `scraper_run_id`, `thread_key`, `root_comment_id`, `comment_count`, `classified_as`, `has_negativity`, `sentiment`, `category`, `severity`, `analysis_status` |
| `channel_daily_snapshots` | Snapshot kênh / ngày | `channel_id`, `snapshot_date`, followers + SUM metrics bài tracked |
| `post_daily_snapshots` | Snapshot bài / ngày | `scraper_run_id`, metrics + `hot_score`/`trend_score` lúc chụp |
| `post_top_comments_daily` | Top 10 comment like / bài / ngày | `scraper_run_id`, `rank`, `like_count`, `author`, `text` |

### Bảng hệ thống

| Bảng | Mô tả |
|------|--------|
| `users` | Tài khoản đăng nhập API/FE |
| `jobs` | Hàng đợi job |
| `failed_jobs` | Job thất bại |

```bash
cd backend-express
npm run db:migrate
```

---

## Cấu hình `.env` (chính)

```env
DB_DATABASE=scraper_social_media

APIFY_API_TOKEN=

SCRAPE_MAX_POSTS=10
SCRAPE_MAX_TOP_COMMENTS=30
SCRAPE_MAX_REPLIES=10

GEMINI_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_COMMENT_ANALYSIS_CHUNK_SIZE=10

ALERT_TREND_THRESHOLD=500
ALERT_HOT_THRESHOLD=800
ALERT_TOP_POSTS_PER_SUBJECT=3

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
MAIL_MAIN=
```

---

## Chạy dự án

### Backend

```bash
cd backend-express
npm install
npm run db:migrate
npm run dev
```

- API: theo `APP_URL` / `PORT` trong `.env`
- Swagger UI: `/api-docs`

### Frontend

```bash
cd frontend-nextjs
npm install
npm run dev
```

---

## API chính

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/subjects/discover` | Gemini → insert `subjects` |
| GET/POST | `/api/subjects` | Danh sách / tạo (kèm `channel_ids[]`) |
| PUT | `/api/subjects/:id` | Cập nhật subject |
| GET | `/api/subjects/:id` | Chi tiết + bài liên quan + aggregate |
| POST/DELETE | `/api/subjects/:id/channels`… | Gắn / gỡ kênh |
| GET/POST/PUT/DELETE | `/api/channels` | CRUD kênh |
| POST | `/api/scraper/facebook/run` | Apify posts + comments — `{ "channel_id": [2,3], "maxResults": 10 }` |
| POST | `/api/scraper/youtube/run` | YouTube video + comments |
| POST | `/api/scraper/tiktok/run` | Apify TikTok video + comments |
| POST | `/api/scraper/youtube/refresh-tail` | Refresh stats video YT cũ (không comment) |
| GET | `/api/social-posts` | Tổng hợp, sort `hot_score` DESC |
| GET | `/api/comments?scraper_run_id=` | Danh sách comment + thread của 1 bài |
| POST | `/api/comments/analyze` | Phân tích AI 1 bài (`scraper_run_id`) — content brief + comment chunk Gemini |
| POST | `/api/alerts/gmail` | Alert mail: bài vượt ngưỡng hot **hoặc** trend + AI top N bài/subject |
| POST | `/api/snapshots/run` | Snapshot metrics (`force` ghi đè). Tuỳ chọn `channel_id` / `scraper_run_id` để chụp 1 kênh hoặc 1 bài |
| GET | `/api/snapshots/status` | Đã có snapshot ngày chưa |
| GET | `/api/snapshots/channels/:id` | Thống kê kênh hôm nay/delta hoặc `date_from`–`date_to` |
| GET | `/api/snapshots/channels/:id/top-posts` | Top bài theo hot/trend trong 1 ngày |
| GET | `/api/snapshots/posts/:id` | Thống kê bài + series |
| GET | `/api/snapshots/posts/:id/top-comments` | Top 10 comment like đã snapshot |
| GET | `/api/snapshots/channels/compare` | So sánh nhiều kênh |
| GET | `/api/snapshots/posts/compare` | So sánh nhiều bài |
| POST | `/api/reports/compare-email` | Gửi mail báo cáo so sánh (sau luồng so sánh; không đụng alert) |

### Demo nhanh

```http
POST /api/subjects/discover

POST /api/scraper/facebook/run
Content-Type: application/json

{ "channel_id": [2, 3], "maxResults": 5 }

POST /api/scraper/youtube/run
Content-Type: application/json

{ "channel_id": [5] }

POST /api/scraper/tiktok/run
Content-Type: application/json

{ "channel_id": [8] }

GET /api/social-posts

POST /api/comments/analyze
Content-Type: application/json

{ "scraper_run_id": 210 }

POST /api/alerts/gmail
Content-Type: application/json

{ "subject_id": 8, "to": "you@example.com" }
```

---

## Thư mục

```
ScraperSocialMedia/
├── READ_ME.md
├── backend-express/
│   ├── app/Models|Repositories|Services|Http|Helpers/...
│   ├── config/                 # apify, gemini, mail, …
│   ├── database/migrations/
│   └── routes/api/
└── frontend-nextjs/
    └── src/app/                # login, home, subjects, channels
```
