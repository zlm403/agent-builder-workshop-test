#!/bin/bash
# classroom-v2 一键更新脚本（在 ECS 上执行）
# 用法：bash /root/classroom-v2/update.sh
set -e
cd /root/classroom-v2

echo "=== 1. 解压最新源码 ==="
tar -xzf /root/classroom-v2.tar.gz --overwrite 2>/dev/null || echo "（跳过，检查 tar 是否存在）"

echo "=== 2. 确保 .env 就位（部署配置，无引号）==="
cp /root/classroom-v2/.env.deploy /root/classroom-v2/.env 2>/dev/null || true

echo "=== 3. 构建镜像 ==="
set -a; source .env; set +a
docker build --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
             --build-arg DATABASE_URL="$DATABASE_URL" \
             -t classroom-v2 .

echo "=== 4. 启动容器（host 网络，端口 3000）==="
docker rm -f classroom-v2 2>/dev/null || true
docker run -d --name classroom-v2 --network host --restart always --env-file /root/classroom-v2/.env classroom-v2
sleep 3

echo "=== 5. prisma db push（同步表结构，显式传 DATABASE_URL）==="
docker exec -e DATABASE_URL="$DATABASE_URL" classroom-v2 npx prisma db push --skip-generate 2>&1 | tail -3

echo "=== 6. 验证 HTTP ==="
curl -s -o /dev/null -w "首页 %{http_code}\n" http://127.0.0.1:3000
curl -s -o /dev/null -w "教师端 %{http_code}\n" http://127.0.0.1:3000/teacher
curl -s -o /dev/null -w "学生端 %{http_code}\n" http://127.0.0.1:3000/student
curl -s -o /dev/null -w "大屏 %{http_code}\n" http://127.0.0.1:3000/screen
echo "=== 完成 ==="
