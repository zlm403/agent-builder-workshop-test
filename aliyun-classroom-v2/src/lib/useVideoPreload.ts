'use client';
// =========================================================
// 章节视频预加载 hook · 打开章节时提前把视频拉进浏览器缓存
// 进入 A1 后静默预加载所有 video 环节页的视频（媒体库内容槽），
// 翻到该页时直接命中缓存、秒出不卡。
// 源列表与 SmartVideo 完全一致（base 优先 + 云端兜底），
// 内网页面缓存本地源、公网页面缓存云端源，浏览器自动选第一个可用。
// =========================================================
import { useEffect } from 'react';
import { getVideoBase } from '@/lib/video-src';
import type { A1Stage } from '@/features/avatarLesson/config';

export function useVideoPreload(group: string, refKeyPrefix: string, stages: A1Stage[]) {
  const keys = stages.filter((s) => s.media === 'video').map((s) => s.key);
  const dep = keys.join(',');

  useEffect(() => {
    if (!keys.length) return;
    let cancelled = false;
    let els: HTMLVideoElement[] = [];

    (async () => {
      try {
        const [base, pagesRes] = await Promise.all([
          getVideoBase(),
          fetch(`/api/pages?group=${group}`).then((r) => r.json()),
        ]);
        const groups: { srcs: string[] }[] = [];
        for (const key of keys) {
          const page = (pagesRes.pages ?? []).find(
            (x: any) => x.kind === 'builtin' && x.refKey === `${refKeyPrefix}:${key}`,
          );
          if (!page?.id) continue;
          const d = await (await fetch(`/api/media?slot=${encodeURIComponent(`page:${page.id}`)}`)).json();
          for (const it of d.items ?? []) {
            if (it.kind !== 'video' || !it.url) continue;
            const src: string = it.url;
            const srcs: string[] = [];
            if (base && !/^https?:\/\//i.test(src)) {
              srcs.push(`${base}${src.startsWith('/') ? '' : '/'}${src}`);
            }
            srcs.push(src);
            groups.push({ srcs });
          }
        }
        if (cancelled) return;

        for (const g of groups) {
          const v = document.createElement('video');
          v.preload = 'auto';
          v.muted = true;
          v.style.display = 'none';
          for (const src of g.srcs) {
            const s = document.createElement('source');
            s.src = src;
            v.appendChild(s);
          }
          document.body.appendChild(v);
          els.push(v);
        }
      } catch { /* 预加载失败静默，不影响正常播放 */ }
    })();

    return () => {
      cancelled = true;
      els.forEach((e) => e.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, refKeyPrefix, dep]);
}
