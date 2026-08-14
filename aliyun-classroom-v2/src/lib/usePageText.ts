'use client';
// =========================================================
// 内置页文字覆盖 hook（客户端）
// 大屏组件渲染内置页时，用此 hook 取该页的 overrides，
// 渲染用「覆盖值 ?? 默认值」。教师端在页面序列里点"改文字"编辑。
// 特殊约定：overrides 中字段值 = REMOVED 表示该行被删除（大屏不显示）。
// =========================================================
import { useEffect, useState } from 'react';

// 删除标记：overrides 中某字段值为它 = 这一行被删掉，大屏不显示
export const REMOVED = '__REMOVED__';

// 渲染辅助：返回要显示的文字；null 表示这一行被删除（不渲染）
export function pageText(
  ov: Record<string, string>,
  key: string,
  def: string,
): string | null {
  const v = ov[key];
  if (v === REMOVED) return null;
  if (v !== undefined && v !== '') return v;
  return def;
}

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

// 当前内置页的 LessonPage id（用于渲染该页的内容块 slot=page:{id}）
export function useCurrentPageId(subState: string | null | undefined): string | null {
  const [pageId, setPageId] = useState<string | null>(null);
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
        if (!closed) setPageId(p?.id ?? null);
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 10000);
    return () => { closed = true; clearInterval(iv); };
  }, [group, subState]);

  return pageId;
}
