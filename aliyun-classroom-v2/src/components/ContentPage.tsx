'use client';
// =========================================================
// 内容页 · 大屏组件（页面序列框架里的"内容页"）
// 一个独立整页：顶部大标题 + 一串内容块（文字/图片/视频/链接/网页）
// 内容块存 MediaItem(slot=page:{pageId})，教师端在媒体库编辑，无需改代码。
// embed 块：iframe 外层深色 + 加载完成后再显示（opacity 0→1），避免白闪。
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

// embed 页是否已加载完成（防止 iframe 加载瞬间白闪）
const loadedSet = new Set<string>();

export default function ContentPage({ pageId, title }: { pageId: string; title: string | null }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/media?slot=${encodeURIComponent(`page:${pageId}`)}`);
        const d = await r.json();
        if (!closed && d.items) {
          setItems(d.items);
          // 已加载过的 iframe（本会话内切回来）直接显示，不再白闪
          const map: Record<string, boolean> = {};
          for (const it of d.items) {
            if (it.kind === 'embed') map[it.id] = loadedSet.has(it.id);
          }
          setLoaded(map);
        }
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 5000);
    return () => { closed = true; clearInterval(iv); };
  }, [pageId]);

  const markLoaded = (id: string) => {
    loadedSet.add(id);
    setLoaded((m) => ({ ...m, [id]: true }));
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 4vw', overflowY: 'auto', background: '#0b1220' }}>
      {title ? (
        <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#fbbf24)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'center', maxWidth: 1100 }}>
          {title}
        </div>
      ) : null}

      {items.length === 0 && (
        <div style={{ fontSize: 18, color: 'var(--muted)' }}>这一页还没有内容，请在教师端点「编辑本页」添加文字/图片/视频/链接/网页。</div>
      )}

      {items.map((it) => {
        if (it.kind === 'text') {
          return (
            <div key={it.id} style={{ maxWidth: 1100, fontSize: 'clamp(20px,2.6vw,34px)', color: '#f8fafc', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
              {it.content}
            </div>
          );
        }
        if (it.kind === 'image') {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={it.id} src={it.url || ''} alt={it.title} style={{ maxWidth: 'min(1100px, 90vw)', maxHeight: '60vh', objectFit: 'contain', borderRadius: 14 }} />
          );
        }
        if (it.kind === 'video') {
          return <video key={it.id} src={it.url || ''} controls autoPlay playsInline style={{ width: 'min(1100px, 90vw)', maxHeight: '60vh', borderRadius: 16, background: '#000' }} />;
        }
        if (it.kind === 'embed') {
          const show = loaded[it.id];
          return (
            <div key={it.id} style={{ width: '100%', flex: 1, minHeight: '60vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220' }}>
              {!show && <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#0b1220' }} />}
              <iframe
                src={it.url || ''}
                title={it.title}
                onLoad={() => markLoaded(it.id)}
                style={{
                  position: 'relative', zIndex: 2, width: '100%', height: '100%', border: 'none', background: '#0b1322',
                  opacity: show ? 1 : 0,
                  transition: 'opacity 120ms ease',
                }}
              />
            </div>
          );
        }
        return (
          <a key={it.id} href={it.url || ''} target="_blank" rel="noreferrer" style={{ fontSize: 'clamp(20px,2.4vw,32px)', color: '#93c5fd', fontWeight: 700 }}>
            {it.title || it.url}
          </a>
        );
      })}
    </div>
  );
}
