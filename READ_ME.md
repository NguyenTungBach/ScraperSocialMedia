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
APIFY_FACEBOOK_ACTOR_ID=KoJrdxJCTtpon81KY
APIFY_FACEBOOK_RESULTS_LIMIT=5

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
| GET | `/api/subjects` | Danh sách subjects |
| GET | `/api/subjects/:id` | Chi tiết + bài liên quan + aggregate |
| POST | `/api/scraper/run` | Apify Actor mới → `scraper_runs` → match → `social_posts` |
| GET | `/api/scraper/apify/runs` | Lịch sử Actor runs trên Apify ([console](https://console.apify.com/actors/runs)) |
| POST | `/api/scraper/run-from-history` | Ingest lại từ `runId` Apify (không chạy Actor mới); body `{ "runId": "..." }` |
| GET | `/api/scraper/runs` | Danh sách bài scrape trong DB local |
| GET | `/api/scraper/runs/:id` | Chi tiết 1 bài trong DB |
| GET | `/api/social-posts` | Tổng hợp, sort `hot_score` DESC |
| POST | `/api/alerts/gmail` | Gửi mail nếu hot **và** trend vượt ngưỡng |

### Demo nhanh

```http
POST /api/subjects/discover

POST /api/scraper/run
Content-Type: application/json

{
  "resultsLimit": 5,
  "startUrls": [
    "https://www.facebook.com/Theanh28",
    "https://www.facebook.com/tintucvtv24"
  ]
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
