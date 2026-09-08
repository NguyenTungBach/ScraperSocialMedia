# NetScopeTrend — Next.js frontend

Giao diện quản trị cho hệ thống **theo dõi & phân tích nội dung mạng xã hội** (Facebook, YouTube, TikTok).

## Luồng nghiệp vụ trên UI

1. **Kênh** (`/channels`) — tạo kênh: tên, link, nền tảng, số lượng cào (`max_posts` / `max_top_comments` / `max_replies`); chạy scrape / snapshot theo kênh.
2. **Đối tượng** (`/subjects`) — tạo đối tượng theo dõi: tên + gắn kênh.
   - **Thiết kế:** 1 đối tượng **N–N** kênh (`subject_channels`, API `channel_ids[]`).
   - **Hiện tại trên UI:** chỉ chọn / vận hành **1–1** (một đối tượng ↔ một kênh).
3. Sau khi có kênh (và thường đã gắn đối tượng), hệ thống **cào bài / comment / reply** theo `channel_id`.
4. Backend lưu metrics quan trọng (`views`, `likes`, `shares`, `angry_count`, `comments` trên bài; **followers** trên kênh) rồi tính **hot_score** / **trend_score** (aggregate theo đối tượng trên dashboard).

## Trang chính

| Path | Ai thấy | Mô tả |
|------|---------|--------|
| `/home` | auth | Dashboard hot topic, chart, scrape theo subject |
| `/subjects` | auth | Quản lý đối tượng (N–N kênh trên API; UI hiện tại 1–1) |
| `/channels` | auth | Quản lý kênh + limit cào + scrape / snapshot |
| `/users` | admin | CRUD tài khoản |
| `/schedules` | admin | Lịch cron + Run now |
| `/settings` | admin | API keys, mail, ngưỡng alert |
| `/login` | public | Đăng nhập |

## Chạy local

```bash
npm install
# NEXT_PUBLIC_API_URL trỏ backend /api ; NEXT_PUBLIC_APP_NAME=NetScopeTrend
npm run dev      # phát triển (Next.js dev server)
npm run build    # build production
npm run start    # chạy bản build (sau build)
```

Frontend dùng **Next.js 14 App Router** nhưng phần lớn màn hình là **Client Component** (`'use client'`): trình duyệt render UI và gọi REST API backend (không tách riêng luồng SSR/CSR trong vận hành hàng ngày).

Chi tiết hệ thống (API, DB, công thức điểm): xem `../READ_ME.md`.
