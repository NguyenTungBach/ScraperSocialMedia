# ScraperSocialMedia

Hệ thống **theo dõi đối tượng MXH**: Gemini lấy tên → Apify scrape bài → match subject → tổng hợp score → cảnh báo Gmail.

## Luồng nghiệp vụ

```
[Gemini]  →  subjects
                    ↑ match %name% / %normalized_name%
[Apify]   →  scraper_runs  →  subjects_scraper_runs
                                      ↓ SUM + công thức
                                social_posts (1 row / subject)
                                      ↓ hot & trend >= ngưỡng
                                Gmail alert
```

### Công thức

- `trend_score = likes×1 + comments×2 + shares×3`
- `hot_score = shares×3 + comments×2 + angry×4 + likes×1`

(Tính trên **tổng** engagement của các bài gắn với subject.)

## Database (`scraper_social_media`)

| Bảng | Mô tả |
|------|--------|
| `subjects` | Đối tượng từ Gemini (`name`, `normalized_name`, …) |
| `scraper_runs` | Mỗi dòng = 1 bài scrape (Apify) |
| `subjects_scraper_runs` | N–N: subject ↔ bài khớp |
| `social_posts` | Tổng hợp 1 subject / 1 row (`hot_score`, `trend_score`, …) |

```bash
cd backend-express
npm run db:migrate
```

## Cấu hình `.env` (chính)

```env
DB_DATABASE=scraper_social_media

APIFY_API_TOKEN=

SCRAPE_MAX_POSTS=10
SCRAPE_MAX_TOP_COMMENTS=30
SCRAPE_MAX_REPLIES=10

GEMINI_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

ALERT_TREND_THRESHOLD=500
ALERT_HOT_THRESHOLD=800

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
MAIL_MAIN=
```

## Chạy Backend

```bash
cd backend-express
npm install
npm run db:migrate
npm run dev
```

- API: theo `APP_URL` / `PORT` trong `.env`
- Swagger UI: thường tại `/api-docs` (xem `app.js`)

## API chính

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/subjects/discover` | Gemini → insert `subjects` (`{data:[]}`) |
| GET | `/api/subjects` | Danh sách subjects (kèm `channels[]`) |
| POST | `/api/subjects` | Tạo subject; body có `channel_ids[]` |
| PUT | `/api/subjects/:id` | Cập nhật subject; body có `channel_ids[]` |
| POST | `/api/subjects/:id/channels` | Gắn kênh `{ "channel_id": 2 }` |
| DELETE | `/api/subjects/:id/channels/:channelId` | Gỡ kênh |
| GET | `/api/subjects/:id` | Chi tiết + bài liên quan + aggregate |
| GET | `/api/channels` | Danh sách kênh (catalog) |
| POST | `/api/channels` | Tạo kênh |
| PUT | `/api/channels/:id` | Cập nhật kênh |
| DELETE | `/api/channels/:id` | Xóa kênh |
| POST | `/api/scraper/facebook/run` | Apify posts + comments; body `{ "channel_id": [2,3], "maxResults": 10 }` |
| POST | `/api/scraper/youtube/run` | YouTube Data API v3 — video + comments |
| POST | `/api/scraper/tiktok/run` | Apify TikTok — video + comments |
| POST | `/api/scraper/youtube/refresh-tail` | Refresh stats video YouTube cũ (không comment) |
| GET | `/api/social-posts` | Tổng hợp, sort `hot_score` DESC |
| POST | `/api/alerts/gmail` | Gửi mail nếu hot **và** trend vượt ngưỡng |

### Demo nhanh

```http
POST /api/subjects/discover

POST /api/scraper/facebook/run
Content-Type: application/json

{
  "channel_id": [2, 3],
  "maxResults": 5
}

POST /api/scraper/youtube/run
Content-Type: application/json

{
  "channel_id": [5]
}

POST /api/scraper/tiktok/run
Content-Type: application/json

{
  "channel_id": [8]
}

GET /api/social-posts

POST /api/alerts/gmail
```

## Thư mục

```
ScraperSocialMedia/
├── READ_ME.md
├── backend-express/
│   ├── app/Models|Repositories|Services|Http/...
│   ├── config/          # apify.js, gemini.js, mail.js, …
│   └── database/migrations/
└── frontend-nextjs/
```
