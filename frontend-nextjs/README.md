# Hoyocodes — Next.js frontend (scaffold)

Khung Next.js tách từ `awa-frontend-nextjs`, tối giản: login + một màn home đã đăng nhập.

## Tính năng hiện tại

- Auth tạm thời **tắt** (`NEXT_PUBLIC_AUTH_REQUIRED=false`) — vào thẳng `/home`
- Trang login vẫn giữ ở `/login` (bật lại bằng `NEXT_PUBLIC_AUTH_REQUIRED=true`)
- Đăng nhập API: `POST /api/auth/login` (`user_code`, `password`) — khớp `backend-express`
- Middleware / RouteGuard tôn trọng flag auth
- UI login lấy cảm hứng từ scaffold AWA

## Chạy local

```bash
cd frontend-nextjs
cp .env.example .env
npm install
npm run dev
```

Mặc định FE: `http://localhost:3000`, API: `http://127.0.0.1:3400/api` (cần `backend-express` chạy).

## Cấu trúc

```
src/
  app/
    login/          # Trang đăng nhập
    (app)/          # Layout shell (Navbar) — không có trong URL
      home/         # Màn chính sau login
  components/       # UI + providers
  lib/api/          # client, auth
  lib/config/       # routes (public/protected)
  lib/utils/        # token, validate, toast
  store/auth.ts     # Zustand session
  middleware.ts     # Auth redirect
```
