'use client';
// =========================================================
// 内置页文字覆盖 hook（客户端）
// 大屏组件渲染内置页时，用此 hook 取该页的 overrides，
// 渲染用「覆盖值 ?? 默认值」。教师端在页面序列里点"改文字"编辑。
// =========================================================
import { useEffect, useState } from 'react';

// subState → 组 映射（纯函数，客户端安全）
export function groupOfSubState(subState: string | null | undefined): 'A0' | 'A1' | 'P2' | 'P3' | null {
  if (!subState) return null;
  if (subState.startsWith('a0:') || subState.startsWith('reveal:')) return 'A0';
  if (subState.startsWith('avatar:')) return 'A1';
  if (subState.startsWith('p2:')) return 'P2';
  if (subState.startsWith('p3:')) return 'P3';
  return null;
}

// 每个组缓存页面列表，避免每 4 秒轮询反复拉
const _cache = new Map<string, { ts: number; pages: any[] }>();
const TTL = 10000;

export function usePageOverrides(subState: string | null | undefined): Record<string, string> {
  const [ov, setOv] = useState<Record<string, string>>({});
  const group = groupOfSubState(subState);

  useEffect(() => {
    if (!group || !subState) return;
    const g = group;
    let closed = false;

    async function fetchIt() {
      try {
        const cached = _cache.get(g);
        let pages: any[];
        if (cached && Date.now() - cached.ts < TTL) {
          pages = cached.pages;
        } else {
          const r = await fetch(`/api/pages?group=${g}`);
          const d = await r.json();
          pages = d.pages ?? [];
          _cache.set(g, { ts: Date.now(), pages });
        }
        const p = pages.find((x: any) => x.kind === 'builtin' && x.refKey === subState);
        if (!closed) setOv((p?.overrides as Record<string, string>) ?? {});
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 10000);
    return () => { closed = true; clearInterval(iv); };
  }, [group, subState]);

  return ov;
}
