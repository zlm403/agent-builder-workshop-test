// =========================================================
// basePath 工具：部署在 storyseed.com.cn/lesson2 子路径时，
// Next.js 只自动给 next/link、router、相对 fetch 加前缀；
// 原生 <iframe src> / <img src> / <a href> 的写死字符串路径
// 不会自动加，需要这里统一补前缀。
// 本地开发（无 BASE_PATH 环境变量）时返回原样，行为不变。
// =========================================================

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(p: string): string {
  if (!BASE_PATH || !p || p.startsWith('http') || p.startsWith('data:') || p.startsWith('blob:')) return p;
  if (!p.startsWith('/')) return p;
  if (p.startsWith(`${BASE_PATH}/`)) return p;
  return `${BASE_PATH}${p}`;
}
