// 教室笔记本视频源 · 统一读取逻辑（纯函数，不含 'use client'）
// 教师端在「视频服务器地址」处配置上课笔记本本地服务基址（存 data/video-server.txt）。
// 所有视频组件统一从这里拿 base，实现「笔记本局域网源优先、阿里云公网兜底」，无需重新构建。

// 拉取当前配置的笔记本视频服务基址；一律 try/catch 返回 null，绝不让基础链路崩。
// 不缓存：每次调用都拉，保证教师端保存后全部端全局生效。
export async function getVideoBase(): Promise<string | null> {
  try {
    const res = await fetch('/api/video-server', { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d?.base === 'string' && d.base ? d.base : null;
  } catch {
    return null;
  }
}

// src 是相对路径（不以 http 开头）才拼笔记本 base 前缀；
// 返回源数组，base 源在前，浏览器按顺序自动向后回退。
export function withBase(src: string, base: string | null): string[] {
  const srcs: string[] = [];
  if (base && !/^https?:\/\//i.test(src)) {
    srcs.push(`${base}${src.startsWith('/') ? '' : '/'}${src}`);
  }
  srcs.push(src);
  return srcs;
}