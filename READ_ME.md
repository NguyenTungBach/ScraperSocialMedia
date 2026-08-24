# ScraperSocialMedia

Hệ thống **thu thập bài viết mạng xã hội** theo đối tượng (tên người / chủ đề), tính điểm xu hướng, và (sau này) cảnh báo qua AI + Gmail/Telegram.

## Hướng đi dự án

### Mục tiêu demo (hiện tại)

1. Lưu **đối tượng theo dõi** (`subjects`) — nhập tay hoặc sau này lấy từ Gemini.
2. Gắn **2–3 trang Facebook** cho mỗi đối tượng (`monitor_sources`).
3. **Crawl** qua Apify (có thể đổi provider khác — DB dùng `external_run_id`, không khóa Apify).
4. Lưu bài vào `social_posts`, **dedup** theo `(platform, platform_post_id)`.
5. Tính score bằng code:
   - `trend_score = likes×1 + comments×2 + shares×3`
   - `hot_score = shares×3 + comments×2 + angry×4 + likes×1`

### Roadmap (chưa implement)

| Giai đoạn | Nội dung |
|-----------|----------|
| Gemini | Lấy danh sách tên VN (4 tháng gần đây) → insert `subjects` |
| AI gom tin | Nhóm bài cùng sự kiện trên nhiều trang → quyết định alert |
| Đa nền tảng | YouTube, X qua `monitor_sources.platform` |
| Alert | So ngưỡng → gửi Gmail/Telegram (chưa lưu DB lịch sử gửi) |

### Luồng nghiệp vụ

```
[Gemini / manual]  →  subjects
                           ↓
                    monitor_sources (FB / YouTube / X URL)
                           ↓
                    scraper_runs (log crawl)
                           ↓
                    social_posts (+ trend_score, hot_score)
                           ↓
              [Gemini: gom tin + vượt ngưỡng?]  (sau)
                           ↓
              Gmail / Telegram API  (sau)
```

## Kiến trúc

| Thành phần | Công nghệ | Vai trò |
|------------|-----------|---------|
| **Backend** | Express.js (`backend-express`) | API scrape, lưu DB, auth |
| **Frontend** | Next.js (`frontend-nextjs`) | UI quản lý (đang phát triển) |
| **Database** | MySQL | `scraper_social_media` |
| **Scraper** | Apify (mặc định) | Facebook Posts Scraper |

## Database

**Tên database:** `scraper_social_media` (cấu hình trong `backend-express/.env`).

**4 bảng demo:**

| Bảng | Mô tả |
|------|--------|
| `subjects` | Đối tượng theo dõi (tên, loại `person`/`topic`/`event`, nguồn `manual`/`gemini`) |
| `monitor_sources` | URL crawl gắn subject (Facebook page/group, sau mở rộng YouTube/X) |
| `scraper_runs` | Log mỗi lần crawl: `source`, `external_run_id`, `subject_id`, … |
| `social_posts` | Bài viết chuẩn hóa + engagement + `trend_score` / `hot_score` + `raw_data` |

**Dedup:** bài trùng `(platform, platform_post_id)` không insert lại — chỉ cập nhật engagement và score.

**Migration:**

```bash
cd backend-express
npm run db:migrate
```

Undo / fresh:

```bash
npm run db:migrate:undo
npm run db:fresh          # drop + create + migrate (xóa toàn bộ data)
```

## Yêu cầu

- Node.js `>= 20`
- MySQL (XAMPP local hoặc instance riêng)
- Copy env: `backend-express/.env.example` → `.env`

## Cấu hình `.env` (chính)

```env
DB_DATABASE=scraper_social_media
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=

APP_PORT=3400

# Apify — bắt buộc để crawl Facebook
APIFY_API_TOKEN=
APIFY_FACEBOOK_ACTOR_ID=KoJrdxJCTtpon81KY
APIFY_FACEBOOK_RESULTS_LIMIT=5

# Gemini — điền sau khi demo crawl ổn
GEMINI_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# Ngưỡng alert (dùng khi bật AI/code alert)
ALERT_TREND_THRESHOLD=500
ALERT_HOT_THRESHOLD=800
```

## Chạy Backend

```bash
cd backend-express
npm install
npm run db:migrate
npm run dev
```

- API: `http://localhost:3400`
- OpenAPI: xem `config/swagger.js` hoặc chạy `npm run openapi:generate`

### Demo nhanh (SQL + API)

**1. Tạo subject và nguồn Facebook:**

```sql
INSERT INTO subjects (name, normalized_name, item_type, status, source, created_at, updated_at)
VALUES ('Demo Subject', 'demo subject', 'person', 'active', 'manual', NOW(), NOW());

INSERT INTO monitor_sources (subject_id, platform, source_type, source_url, priority, is_active, created_at, updated_at)
VALUES
  (1, 'facebook', 'page', 'https://www.facebook.com/Theanh28', 1, 1, NOW(), NOW()),
  (1, 'facebook', 'page', 'https://www.facebook.com/tintucvtv24', 2, 1, NOW(), NOW());
```

**2. Chạy crawl theo subject:**

```http
POST http://localhost:3400/api/scraper/facebook/run
Content-Type: application/json

{
  "subject_id": 1,
  "resultsLimit": 5
}
```

**3. Xem bài hôm nay:**

```http
GET http://localhost:3400/api/scraper/facebook/posts?subject_id=1&today=true
```

### API scraper hiện có

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/scraper/facebook/run` | Crawl Apify; `subject_id` hoặc `startUrls` tùy chọn |
| GET | `/api/scraper/facebook/runs` | Danh sách lần chạy |
| GET | `/api/scraper/facebook/runs/:runId` | Chi tiết run (`external_run_id` Apify) |
| GET | `/api/scraper/facebook/posts` | Danh sách bài; filter `subject_id`, `today` |

## Chạy Frontend

```bash
cd frontend-nextjs
npm install
# .env: NEXT_PUBLIC_API_URL=http://localhost:3400
npm run dev
```

- FE mặc định: `http://localhost:3000`

## Thư mục dự án

```
ScraperSocialMedia/
├── READ_ME.md
├── backend-express/       # Express API, migrations, scraper
│   ├── app/
│   │   ├── Models/        # Subject, MonitorSource, ScraperRun, SocialPost
│   │   ├── Repositories/
│   │   └── Http/Controllers/Api/
│   ├── config/            # apify.js, gemini.js, database.js
│   └── database/migrations/
└── frontend-nextjs/       # Next.js UI
```

## Production (tùy chọn)

```bash
cd backend-express
npm run pm2:start
```

Queue / scheduler có sẵn từ template cũ; chưa dùng cho luồng scrape demo.
