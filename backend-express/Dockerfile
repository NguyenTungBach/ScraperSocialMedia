# backend-express — Node 20, Cloud Run–ready (PORT / APP_PORT trong server.js).
#
# Một image dùng cho develop | staging | production — không “gán sẵn” port theo nhánh trong image.
# Giống EC2/PM2: truyền biến khi deploy / docker run (khớp .github/workflows/develop_cicd_nextjs_express.yml):
#   develop:    APP_PORT=3400  (và PORT nếu cần)
#   staging:    APP_PORT=3410
#   production: APP_PORT=3411
#
# GCP Cloud Run: thường mỗi service một URL; platform có thể set PORT=8080 (mặc định) cho mọi môi trường —
# không trùng nhau vì mỗi service là process/revision riêng. Muốn số port nội bộ khác (vd 3410) thì
# cấu hình container port + env trên revision tương ứng, không cần trùng với AWS.
FROM node:20-bookworm-slim

WORKDIR /app

# Puppeteer / Chromium (PDF HR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p storage/logs storage/app public/storage \
    && chown -R node:node /app

USER node

ENV NODE_ENV=production

# EXPOSE chỉ mang tính tài liệu. Cổng thật = APP_PORT hoặc PORT từ môi trường chạy.
EXPOSE 8080

CMD ["node", "server.js"]
