'use client';
// =========================================================
// 大屏内容槽渲染器 · 读内容框架（教师端管理）
// 按 slot 渲染该位置的所有内容块：文字/图片/视频/链接
// =========================================================
import { useEffect, useState } from 'react';

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  content?: string | null;
  slot: string;
  sort: number;
}

export default function MediaPlayer({ slot, title }: { slot: string; title: string }) {
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

  if (items.length === 0) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 800, color: '#f8fafc' }}>{title}</div>
        <div style={{ fontSize: 16, color: 'var(--muted)' }}>这里还没有内容，请老师在教师端「内容框架」里添加。</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 4vw', overflowY: 'auto' }}>
      <div style={{ fontSize: 'clamp(20px,2.4vw,32px)', fontWeight: 800, color: '#f8fafc' }}>{title}</div>
      {items.map((it) => {
        if (it.kind === 'text') {
          return (
            <div key={it.id} style={{ maxWidth: 1100, fontSize: 'clamp(20px,2.6vw,36px)', color: '#f8fafc', textAlign: 'center', lineHeight: 1.7, fontWeight: 600, whiteSpace: 'pre-wrap' }}>
              {it.content}
            </div>
          );
        }
        if (it.kind === 'image') {
          return (
            <div key={it.id} style={{ maxWidth: 1100, maxHeight: '60vh' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url || ''} alt={it.title} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 14 }} />
            </div>
          );
        }
        if (it.kind === 'video') {
          return (
            <video key={it.id} src={it.url || ''} controls autoPlay playsInline style={{ width: 'min(1100px, 90vw)', maxHeight: '62vh', borderRadius: 16, background: '#000' }} />
          );
        }
        if (it.kind === 'embed') {
          return (
            <iframe key={it.id} src={it.url || ''} title={it.title} style={{ width: 'min(1200px, 94vw)', height: '66vh', border: '1px solid rgba(251,146,60,.3)', borderRadius: 16, background: '#fff' }} />
          );
        }
        // link
        return (
          <a key={it.id} href={it.url || ''} target="_blank" rel="noreferrer" style={{ fontSize: 'clamp(20px,2.4vw,32px)', color: '#93c5fd', fontWeight: 700 }}>
            {it.title || it.url}
          </a>
        );
      })}
    </div>
  );
}
