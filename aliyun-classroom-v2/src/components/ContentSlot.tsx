'use client';
// =========================================================
// 内容槽内嵌渲染器 · 在页面骨架内显示某个插槽的内容块
// 教师端内容管理往 slot 放文字/图片/视频/链接，这里就渲染出来
// 用于：步骤下方补充内容、钩子文案、提示语等"内容可换"的部分
// =========================================================
import { useEffect, useState } from 'react';
import SmartVideo from '@/components/SmartVideo';

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  content?: string | null;
  slot: string;
  align?: string;
}

export default function ContentSlot({
  slot,
  style,
  textSize,
}: {
  slot: string;
  style?: React.CSSProperties;
  textSize?: number;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/media?slot=${encodeURIComponent(slot)}`);
        const d = await r.json();
        if (!closed && d.items) setItems(d.items);
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 5000);
    return () => { closed = true; clearInterval(iv); };
  }, [slot]);

  if (items.length === 0) return null;

  // 每个块的横向对齐方式
  const alignItem = (it: MediaItem): React.CSSProperties => {
    const a = it.align ?? 'center';
    if (a === 'left') return { width: '100%', alignItems: 'flex-start', textAlign: 'left' };
    if (a === 'right') return { width: '100%', alignItems: 'flex-end', textAlign: 'right' };
    return { alignItems: 'center', textAlign: 'center' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {items.map((it) => {
        const align = alignItem(it);
        if (it.kind === 'text') {
          return (
            <div key={it.id} style={{ maxWidth: 1100, fontSize: textSize ?? 'clamp(18px,2.2vw,30px)', color: '#f8fafc', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontWeight: 600, display: 'flex', flexDirection: 'column', ...align }}>
              <div style={{ width: '100%' }}>{it.content}</div>
            </div>
          );
        }
        if (it.kind === 'image') {
          return (
            <div key={it.id} style={{ maxWidth: 1100, maxHeight: '50vh', display: 'flex', flexDirection: 'column', ...align }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url || ''} alt={it.title} style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 14 }} />
            </div>
          );
        }
        if (it.kind === 'video') {
          return (
            <div key={it.id} style={{ display: 'flex', flexDirection: 'column', ...align }}>
              <SmartVideo src={it.url || ''} controls autoPlay playsInline style={{ width: 'min(900px, 86vw)', maxHeight: '52vh', borderRadius: 14, background: '#000' }} />
            </div>
          );
        }
        if (it.kind === 'embed') {
          return (
            <div key={it.id} style={{ display: 'flex', flexDirection: 'column', ...align }}>
              <iframe src={it.url || ''} title={it.title} style={{ width: 'min(1100px, 92vw)', height: '58vh', border: '1px solid rgba(251,146,60,.3)', borderRadius: 14, background: '#fff' }} />
            </div>
          );
        }
        return (
          <div key={it.id} style={{ display: 'flex', flexDirection: 'column', ...align }}>
            <a href={it.url || ''} target="_blank" rel="noreferrer" style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#93c5fd', fontWeight: 700 }}>
              {it.title || it.url}
            </a>
          </div>
        );
      })}
    </div>
  );
}
