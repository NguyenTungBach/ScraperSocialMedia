# ScraperSocialMedia

Hệ thống **theo dõi & phân tích nội dung mạng xã hội** (Facebook, YouTube, TikTok): cào bài + comment → lưu DB → tính chỉ số hot/trend & engagement → AI phân tích → cảnh báo mail khi vượt ngưỡng.

**Stack:** Backend Express (MySQL/Sequelize) · Frontend Next.js · Apify (FB/TikTok) · YouTube Data API · Gemini · SMTP/Gmail (hoặc SES) · PM2 (API + queue + schedule).

---

## Định hướng

| Giai đoạn | Mục tiêu |
|-----------|----------|
| **Hiện tại (demo)** | Chạy trên hạ tầng free (Render, Aiven MySQL, Apify free, Gemini cá nhân, YouTube API). Cào bài mới theo kênh (async queue), tổng hợp score, UI quản lý (subjects/channels/users/schedules/settings), alert/AI. |
| **Mục tiêu vận hành** | Cào hàng ngày ổn định qua PM2 schedule; chi phí cloud/API do bên vận hành trả; server production riêng (không phụ thuộc tài khoản free cá nhân). |
| **Định hướng tiếp** | So sánh cùng một “kênh/brand” trên 3 MXH (engagement từ `scraper_runs` + followers từ `channels`); thống kê; AI đánh giá nền tảng nào đang phát triển hơn, comment tích cực/tiêu cực. |

### Luồng nghiệp vụ (hiện tại)

```
[Channels] ──POST /scraper/*/run (202)──► async_status_jobs + jobs (queue)
                    │                         │
                    │                    queue-worker
                    ▼                         ▼
              scraper_runs (metrics bài) + channels.followers
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
                                   Gmail/SES alert (+ AI top bài/subject)

[general_schedules] ──PM2 *-schedule──► spawn `npm run app:*` (scrape / snapshot / alert)
[key_scraps + general_settings] ──SettingsCache──► Apify / YouTube / Gemini / Mail / Alert thresholds
```

---

## Tính năng

### Đã có

| Nhóm | Chi tiết |
|------|----------|
| **Cào dữ liệu** | Facebook (Apify), YouTube (Data API v3), TikTok (Apify). Limit **theo từng kênh**: `channels.max_posts` / `max_top_comments` / `max_replies` (default tạo kênh: **10 / 30 / 10** từ `config/scrapeLimits.js`). API scrape **async** (HTTP **202** + `async_job_id`); CLI sync: `npm run app:*-scrape`. Có `youtube/refresh-tail` cập nhật stats video cũ. |
| **Queue scrape** | `POST /api/scraper/{facebook\|youtube\|tiktok}/run` enqueue job → bảng `async_status_jobs` + `jobs`. FE poll `GET /api/scraper/async-status/:id` (và `async-active` / `async-health`). Cần process `${PM2_API_NAME}-queue` (`npm run queue:worker`). 409 nếu cùng `scope_key` đang pending/running. |
| **Chỉ số** | **Bài** (`scraper_runs`): likes, comments, shares, angry, views (`follow` cột luôn 0). **Kênh** (`channels.followers`): page likes / YT subscribers / TT fans. **Subject** (`social_posts`): SUM engagement bài + `follow` = SUM followers kênh gắn. Tính **hot_score**, **trend_score**; suy ra Thảo luận / Tương tác / Cảm xúc (công thức bên dưới). |
| **Đối tượng & kênh** | CRUD `subjects`, `channels`; gắn N–N subject ↔ channel; discover subject qua Gemini. FE chỉnh limit cào từng kênh. |
| **Comment + AI** | Lưu comment/thread; Gemini gắn sentiment, category, severity, reason; **content brief** cho bài. Chunk **10 đơn vị**/lần. Tự chạy sau scrape; nút **Phân tích comment** trên UI (FB/YT/TT). FE: danh sách + bảng phân tích **10 mục/trang**. |
| **Snapshot metrics** | 3 bảng ngày: `channel_daily_snapshots`, `post_daily_snapshots` (kèm hot/trend), `post_top_comments_daily`. Chỉ kênh ∈ `subject_channels`. CLI `npm run app:metric-snapshot`; lịch mặc định mỗi 5h; FE nút Snapshot + thống kê kênh. |
| **So sánh + mail** | UI so sánh nhiều kênh/bài theo khoảng ngày (snapshot); gửi báo cáo mail (`POST /reports/compare-email`) — tách khỏi alert hot/trend. |
| **Alert** | `POST /api/alerts/gmail`: mail khi bài vượt ngưỡng **hot hoặc trend** (tháng hiện tại); AI **top 3 bài hot/subject**. CLI `npm run app:alert-gmail`. Ngưỡng đọc từ `general_settings` (Admin → Settings). |
| **Lịch chạy (PM2)** | Bảng `general_schedules` + process `${PM2_API_NAME}-schedule`: đến giờ **spawn** `npm run app:*` (không `await` trong worker). Reload từ DB mỗi `SCHEDULE_RELOAD_MS` (mặc định 60s). FE admin `/schedules` (CRUD + Run now). Timezone `APP_TIMEZONE=Asia/Ho_Chi_Minh`. Seed mặc định: snapshot 5h, alert 17:00, scrape FB/YT/TT 05:00, YT refresh-tail 2 ngày/lần. Sau khi bật PM2 schedule, **tắt crontab/GH Actions trùng**. |
| **Cấu hình runtime (Settings)** | API keys Apify/YouTube/Gemini → `key_scraps`; ngưỡng alert + SMTP/SES → `general_settings`. Seed lần đầu từ `.env`; **runtime đọc DB** (SettingsCache), không đọc lại các biến đó từ `.env`. FE admin `/settings`. |
| **Phân quyền** | Role `admin` (full) \| `member` (chỉ đọc GET). Middleware `RequireAdminForWrites`: mọi POST/PUT/DELETE cần admin. CRUD users / settings / schedules chỉ admin. FE: `/users`, `/schedules`, `/settings` ẩn với member. |
| **Hệ thống** | Auth JWT; BE API (tìm kiếm, paginate, CRUD); FE: home, subjects, channels, users, schedules, settings; queue/jobs; migrate + seed DB. |

### Đang / sẽ làm

| Nhóm | Chi tiết |
|------|----------|
| **Định hướng tiếp** | So sánh đa brand/kênh sâu hơn trên 3 MXH; AI đánh giá nền tảng phát triển; production ổn định lâu dài. |

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

Ngưỡng alert mặc định: `ALERT_HOT_THRESHOLD`, `ALERT_TREND_THRESHOLD` (seed → `general_settings`) — bài vượt **một trong hai** ngưỡng là candidate.
Top bài AI trong mail alert: cố định **3** bài hot nhất / subject.
Chunk phân tích comment: cố định **10** đơn vị / lần gọi Gemini.
Ngưỡng nhãn up/down mail so sánh: `COMPARE_UPTREND_PCT`, `COMPARE_DOWNTREND_PCT` (mặc định 5 / -5, vẫn từ `.env`).

---

## Luồng scrape async

```
1. POST /api/scraper/{facebook|youtube|tiktok}/run
   · Body: { "channel_id": [2, 3] }  (optional subject_id → scope_key)
   · Limit cào lấy từ từng channel (max_posts / max_top_comments / max_replies)

2. ScraperAsyncService.enqueue
   · scope_key = subject:{id} hoặc channels:{ids}
   · Nếu đã có job pending|running cùng type+scope → 409
   · Tạo async_status_jobs + đẩy jobs (queue) → HTTP 202 + async_job_id

3. queue-worker xử lý FacebookScrapeJob / YoutubeScrapeJob / TikTokScrapeJob
   · Cào + upsert + Gemini sau scrape
   · Cập nhật async_status_jobs: running → success|failed + result_json

4. FE poll GET /api/scraper/async-status/:id (hoặc async-active)
```

**CLI sync** (scheduler / cron / debug): `npm run app:facebook-scrape` · `app:youtube-scrape` · `app:tiktok-scrape` — chạy trực tiếp, không qua HTTP 202.

---

## Luồng Alert Gmail (`POST /api/alerts/gmail`)

```
1. listAlertPosts
   · Bài FB/YT/TT có link subject (subjects_scraper_runs)
   · posted_at trong tháng lịch hiện tại
   · hot_score >= ALERT_HOT_THRESHOLD  HOẶC  trend_score >= ALERT_TREND_THRESHOLD
   · (tuỳ chọn) lọc subject_id nếu body có subject_id

2. Nếu không có candidate → { sent: false, reason: "no_candidates_over_threshold" }

3. Nhóm bài theo subject → mỗi subject lấy top 3 bài theo hot_score

4. Với từng bài trong top 3:
   · content_brief (Gemini) nếu chưa có
   · phân tích comment pending / thiếu kết quả (Gemini, chunk 10 đơn vị/lần)

5. buildAlertEmail → gửi SMTP/SES tới MAIL_MAIN (hoặc body.to)
   · BCC: MAIL_ALERT_BCC + body.bcc (dedupe, bỏ trùng người nhận chính)
```

**Lưu ý:** Ngưỡng là **OR** (hot **hoặc** trend). Mail liệt kê **tất cả** candidate vượt ngưỡng; phần AI comment trong mail chỉ chạy trên **top N bài hot/subject**.

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

**`comments_analysis.reason` thường gặp:** `already_done` · `no_comments` · `not_found`

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

jobs / failed_jobs          (queue Laravel-style)
async_status_jobs           (trạng thái scrape async cho FE)
key_scraps                  (API keys Apify / YT / Gemini)
general_settings            (alert thresholds + mail)
general_schedules           (cron expression + npm run app:*)
```

### Bảng nghiệp vụ

| Bảng | Mô tả | Trường chính |
|------|--------|--------------|
| `subjects` | Đối tượng theo dõi (người/chủ đề) | `name`, `normalized_name`, `item_type`, `status`, `source` |
| `channels` | Catalog kênh MXH | `name`, `url`, `type_channel`, `followers`, `post_count`, `max_posts`, `max_top_comments`, `max_replies`, `raw_data` |
| `subject_channels` | N–N subject ↔ channel | `subject_id`, `channel_id` |
| `scraper_runs` | **1 dòng = 1 bài/video** | `platform`, `platform_post_id`, `post_url`, `title`, `text`, metrics, `posted_at`, `channel_id`, `raw_data`, `content_brief*` |
| `subjects_scraper_runs` | N–N subject ↔ bài khớp | `subject_id`, `scraper_run_id` |
| `social_posts` | **Cache 1 row / subject** (tháng lịch hiện tại) | engagement SUM; `follow` = SUM followers kênh; `trend_score`, `hot_score`, `posts_count` |
| `post_comments` | Comment (kèm reply) theo bài | `scraper_run_id`, author/text/likes, sentiment/category/severity, `analysis_status` |
| `comment_threads` | Thread comment + kết quả AI | `scraper_run_id`, `thread_key`, `classified_as`, `analysis_status`, … |
| `channel_daily_snapshots` | Snapshot kênh / ngày | `channel_id`, `snapshot_date`, followers + SUM metrics |
| `post_daily_snapshots` | Snapshot bài / ngày | `scraper_run_id`, metrics + hot/trend lúc chụp |
| `post_top_comments_daily` | Top 10 comment like / bài / ngày | `scraper_run_id`, `rank`, `like_count`, `author`, `text` |

### Bảng hệ thống / vận hành

| Bảng | Mô tả |
|------|--------|
| `users` | Tài khoản: role `admin` \| `member` |
| `jobs` / `failed_jobs` | Hàng đợi job (queue worker) |
| `async_status_jobs` | Trạng thái scrape async (`pending`/`running`/`success`/`failed`) + `scope_key`, `result_json` |
| `key_scraps` | API keys runtime (`APIFY_API_TOKEN`, `YOUTUBE_API_KEY`, `GEMINI_*`) |
| `general_settings` | Alert thresholds + cấu hình mail SMTP/SES |
| `general_schedules` | Lịch cron: `cron_expression`, `command` (`npm run app:*`), `enabled`, `last_status` |

```bash
cd backend-express
npm run db:migrate
npm run db:seed          # users + key_scraps + general_settings + general_schedules
# hoặc seed từng file: npm run db:seed:one -- 20260904140000-key-scraps-seeder.js
```

---

## Cấu hình `.env` (chính)

```env
DB_DATABASE=scraper_social_media

JWT_SECRET=change-me-to-a-long-random-string
APP_TIMEZONE=Asia/Ho_Chi_Minh
# PM2_API_NAME=scrap-social-media-api

# --- Seed lần đầu vào DB (runtime đọc key_scraps + general_settings) ---
APIFY_API_TOKEN=
YOUTUBE_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.5-flash-lite

ALERT_TREND_THRESHOLD=500
ALERT_HOT_THRESHOLD=800

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
MAIL_MAIN=
# MAIL_ALERT_BCC=...

# Limit cào default khi tạo kênh: 10 / 30 / 10 (config/scrapeLimits.js)
# Không còn đọc MAX_POSTS từ .env — chỉnh trên từng channel hoặc Admin UI.
```

Sau seed, chỉnh key/mail/ngưỡng tại **Admin → Settings** (không cần sửa `.env` rồi restart, trừ DB/JWT/PM2).

---

## Chạy dự án

### Backend (dev)

```bash
cd backend-express
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # API
# terminal khác — bắt buộc nếu scrape qua UI/API async:
npm run queue:worker
# tuỳ chọn lịch local:
npm run schedule:worker
```

- API: theo `APP_URL` / `APP_PORT` trong `.env`
- Swagger UI: `/api-docs`

### Backend (production — PM2)

```bash
cd backend-express
npm run pm2:start           # API + *-queue + *-schedule
# hoặc: pm2 start ecosystem.config.cjs
```

Ba process: `${PM2_API_NAME}`, `${PM2_API_NAME}-queue`, `${PM2_API_NAME}-schedule`.

### Frontend

```bash
cd frontend-nextjs
npm install
npm run dev
```

- `NEXT_PUBLIC_API_URL` trỏ tới backend `/api`

---

## API chính

| Method | Path | Mô tả | Quyền |
|--------|------|--------|--------|
| POST | `/api/auth/login` | Đăng nhập | public |
| GET | `/api/profile` | Profile user | auth |
| GET/POST/PUT/DELETE | `/api/users` | CRUD users | **admin** |
| GET/PUT | `/api/settings` | Xem / cập nhật key_scraps + general_settings | **admin** |
| GET/POST/PUT/DELETE | `/api/schedules` | CRUD lịch | **admin** |
| POST | `/api/schedules/:id/run` | Chạy ngay 1 lịch | **admin** |
| POST | `/api/subjects/discover` | Gemini → insert `subjects` | admin write |
| GET/POST | `/api/subjects` | Danh sách / tạo (kèm `channel_ids[]`) | GET: auth · write: admin |
| PUT | `/api/subjects/:id` | Cập nhật subject | admin |
| GET | `/api/subjects/:id` | Chi tiết + bài liên quan + aggregate | auth |
| POST/DELETE | `/api/subjects/:id/channels`… | Gắn / gỡ kênh | admin |
| GET/POST/PUT/DELETE | `/api/channels` | CRUD kênh (kèm scrape limits) | GET: auth · write: admin |
| POST | `/api/scraper/facebook/run` | Enqueue FB scrape → **202** + `async_job_id` | admin |
| POST | `/api/scraper/youtube/run` | Enqueue YT scrape → **202** | admin |
| POST | `/api/scraper/tiktok/run` | Enqueue TT scrape → **202** | admin |
| GET | `/api/scraper/async-status/:id` | Poll trạng thái job | auth |
| GET | `/api/scraper/async-status?job_type=&scope_key=` | Latest job theo scope | auth |
| GET | `/api/scraper/async-active` | Các job pending\|running | auth |
| GET | `/api/scraper/async-health` | Chẩn đoán queue / stale | auth |
| POST | `/api/scraper/youtube/refresh-tail` | Refresh stats video YT cũ | admin |
| GET | `/api/social-posts` | Tổng hợp, sort `hot_score` DESC | auth |
| GET | `/api/comments?scraper_run_id=` | Comment + thread 1 bài | auth |
| POST | `/api/comments/analyze` | Phân tích AI 1 bài | admin |
| POST | `/api/alerts/gmail` | Alert mail hot **hoặc** trend + AI top N | admin |
| POST | `/api/snapshots/run` | Snapshot metrics (`force`, optional channel/post) | admin |
| GET | `/api/snapshots/status` | Đã có snapshot ngày chưa | auth |
| GET | `/api/snapshots/channels/:id` | Thống kê kênh | auth |
| GET | `/api/snapshots/channels/:id/top-posts` | Top bài theo hot/trend 1 ngày | auth |
| GET | `/api/snapshots/posts/:id` | Thống kê bài + series | auth |
| GET | `/api/snapshots/posts/:id/top-comments` | Top 10 comment like đã snapshot | auth |
| GET | `/api/snapshots/channels/compare` | So sánh nhiều kênh | auth |
| GET | `/api/snapshots/posts/compare` | So sánh nhiều bài | auth |
| POST | `/api/reports/compare-email` | Gửi mail báo cáo so sánh | admin |

### Demo nhanh

```http
POST /api/subjects/discover

POST /api/scraper/facebook/run
Content-Type: application/json

{ "channel_id": [2, 3] }

# → 202 { data: { async_job_id, status: "pending", ... } }
GET /api/scraper/async-status/42

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

## FE — trang chính

| Path | Ai thấy | Mô tả |
|------|----------|--------|
| `/home` | auth | Dashboard hot topic / social posts |
| `/subjects` | auth | Quản lý đối tượng |
| `/channels` | auth | Quản lý kênh + limit cào + scrape / snapshot |
| `/users` | **admin** | CRUD tài khoản (admin / member) |
| `/schedules` | **admin** | CRUD lịch cron + Run now |
| `/settings` | **admin** | API keys + mail + ngưỡng alert |
| `/login` | public | Đăng nhập |

Member: xem dữ liệu (GET); không tạo/sửa/xoá, không scrape/alert/settings.

---

## CLI / scripts (`backend-express`)

| Script | Mô tả |
|--------|--------|
| `npm run app:facebook-scrape` | Cào FB sync (mọi kênh facebook hoặc theo args) |
| `npm run app:youtube-scrape` | Cào YT sync |
| `npm run app:tiktok-scrape` | Cào TT sync |
| `npm run app:youtube-refresh-tail` | Refresh stats video YT cũ |
| `npm run app:metric-snapshot` | Snapshot metrics ngày |
| `npm run app:alert-gmail` | Gửi alert vượt ngưỡng |
| `npm run queue:worker` | Worker xử lý jobs + scrape async |
| `npm run schedule:worker` | Đọc `general_schedules`, đăng ký node-cron |
| `npm run pm2:start` / `pm2:reload` | API + queue + schedule |

---

## Thư mục

```
ScraperSocialMedia/
├── READ_ME.md
├── .github/workflows/          # cron GH (tắt khi dùng PM2 schedule)
├── backend-express/
│   ├── app/
│   │   ├── Console/Commands/   # app:* CLI
│   │   ├── Constants/          # UserType, AppSettingsKeys, ScraperAsyncStatus, …
│   │   ├── Helpers/
│   │   ├── Http/Controllers|Middleware|Requests/
│   │   ├── Jobs/               # Facebook|Youtube|TikTokScrapeJob
│   │   ├── Models/
│   │   ├── Repositories/
│   │   └── Services/           # Scrape*, ScraperAsync*, Settings*, Schedule*, …
│   ├── config/                 # apify, gemini, mail, scrapeLimits, …
│   ├── database/migrations|seeders/
│   ├── routes/api/             # scraper, schedules, settings, users, …
│   ├── scripts/                # queue-worker, scheduler, run-command
│   ├── ecosystem.config.cjs    # PM2: api + queue + schedule
│   └── server.js
└── frontend-nextjs/
    └── src/
        ├── app/(app)/          # home, subjects, channels, users, schedules, settings
        ├── components/hot-topic/
        └── lib/api/            # channels, scraper, schedules, settings, users, …
```
