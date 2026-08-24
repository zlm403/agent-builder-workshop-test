# 多阶段构建：在阿里云 ECS 上打包 Next.js 应用
# 使用 node:20-alpine，并用 npmmirror 国内镜像加速依赖安装

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm config set registry https://registry.npmmirror.com
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
# NEXT_PUBLIC_* 必须在构建期内联进前端（学生扫码链接依赖它）
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# DATABASE_URL 构建期也需要（collecting page data 会执行部分服务端路由）
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN echo "BUILD_ENV_CHECK DATABASE_URL=[$DATABASE_URL] len=${#DATABASE_URL}"
# SKIP_BUILD=1 时直接用上传包内完整 .next，不重新 build（规避容器内 build 残缺导致 404）
ARG SKIP_BUILD=0
RUN if [ "$SKIP_BUILD" = "1" ]; then echo "[skip-build] use provided .next"; else npm run build; fi

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# 运行时环境变量（DATABASE_URL / LLM_* 等）由 `docker run --env-file .env` 注入
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# ⚠️ 必须 COPY next.config.mjs！否则 next start 找不到 config，basePath 失效（2026-08-24 教训）
COPY --from=builder /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "start"]
