'use client';
// =========================================================
// 章节视频真·预读 hook · 打开章节时完整下载视频存浏览器本地缓存
// 进入 A1 后，把该章所有 video 环节页的视频（媒体库内容槽）用 fetch
// 完整下载进 IndexedDB（videoCache）。播放时 SmartVideo 优先取缓存，
// 同浏览器再次播放直接本地读、秒开不卡。
// 源选择与 SmartVideo 一致：base（本地/内网源）优先，失败自动改云端源；
// 公网页面因 PNA 拦内网，会自然落到云端源下载。
// =========================================================
import { useEffect } from 'react';
import { getVideoBase } from '@/lib/video-src';
import { cacheVideo, getCachedVideo } from '@/lib/videoCache';
import type { A1Stage } from '@/features/avatarLesson/config';

// 下载单个视频（base 源优先，失败回退云端源），成功后入缓存
async function downloadAndCache(videoUrl: string, base: string | null): Promise<boolean> {
  // 已缓存则跳过
  const hit = await getCachedVideo(videoUrl);
  if (hit) return true;

  const candidates: string[] = [];
  if (base && !/^https?:\/\//i.test(videoUrl)) {
    candidates.push(`${base}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`);
  }
  candidates.push(videoUrl);

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0 && (await cacheVideo(videoUrl, blob))) return true;
    } catch {
      continue; // 本候选失败，尝试下一个
    }
  }
  return false;
}

export function useVideoPreload(group: string, refKeyPrefix: string, stages: A1Stage[]) {
  const keys = stages.filter((s) => s.media === 'video').map((s) => s.key);
  const dep = keys.join(',');

  useEffect(() => {
    if (!keys.length) return;
    let cancelled = false;

    (async () => {
      try {
        const [base, pagesRes] = await Promise.all([
          getVideoBase(),
          fetch(`/api/pages?group=${group}`).then((r) => r.json()),
        ]);
        for (const key of keys) {
          if (cancelled) return;
          const page = (pagesRes.pages ?? []).find(
            (x: any) => x.kind === 'builtin' && x.refKey === `${refKeyPrefix}:${key}`,
          );
          if (!page?.id) continue;
          const d = await (await fetch(`/api/media?slot=${encodeURIComponent(`page:${page.id}`)}`)).json();
          for (const it of d.items ?? []) {
            if (cancelled) return;
            if (it.kind !== 'video' || !it.url) continue;
            // 串行下载，避免同时抢带宽；失败静默不影响后续
            await downloadAndCache(it.url, base);
          }
        }
      } catch { /* 预读失败静默，不影响正常播放 */ }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, refKeyPrefix, dep]);
}
