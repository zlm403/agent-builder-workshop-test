import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * 构建数据库连接 URL，强制连接池上限为 10。
 *
 * 背景：.env 里 connection_limit=1 会把并发能力锁死——同一时间只允许 1 个
 * DB 查询，教师/大屏/学生端任何并发请求都会排队 10 秒超时（pool_timeout=10）
 * 然后返回 404/500，表现为"慢得惊人"。这里在代码层覆盖为 10，保证并发。
 * Supabase pgbouncer 模式下单 client 不超过 60 即安全。
 */
function buildDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    // 浏览器端没有 DATABASE_URL（环境变量只在服务端）。
    // db.ts 因 courseConfig.ts（纯函数与 DB 操作混在一起）被打包进客户端 bundle，
    // 但浏览器端不会真正查询 DB，返回空串避免阻断 hydration。
    if (typeof window !== 'undefined') return '';
    throw new Error('DATABASE_URL 未配置（服务端）');
  }
  try {
    const u = new URL(raw);
    u.searchParams.set('connection_limit', '10');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '10');
    return u.toString();
  } catch {
    // URL 解析失败（非标准串）则原样返回，避免阻断启动
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasources: { db: { url: buildDatabaseUrl() } } });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
