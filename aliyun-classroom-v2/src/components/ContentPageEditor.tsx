'use client';
// =========================================================
// 教师端 · 内容页编辑器（编辑某一内容页里的内容块）
// 一个内容页 = 大标题 + 一串内容块（文字/图片/视频/链接/网页），
// 内容块存 MediaItem(slot=page:{pageId})，这里做增删改排序隐藏。
// =========================================================
import { useCallback, useEffect, useState } from 'react';

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  content?: string | null;
  slot: string;
  sort: number;
  align?: string;
  hidden?: boolean;
}

const KIND_OPTIONS: Record<string, string> = {
  text: '文字',
  image: '图片',
  video: '视频',
  link: '链接',
  embed: '网页',
};

export default function ContentPageEditor({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const slot = `page:${pageId}`;
  const [items, setItems] = useState<MediaItem[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/media?slot=${encodeURIComponent(slot)}&includeHidden=1`);
      const d = await r.json();
      if (d.items) setItems(d.items);
    } catch { /* noop */ }
  }, [slot]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (kind === 'text' && !content.trim()) { setMsg('文字内容不能为空'); return; }
    if (kind !== 'text' && !url.trim()) { setMsg('请填写地址或上传文件'); return; }
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || '内容',
          kind,
          url: url.trim() || undefined,
          content: content.trim() || undefined,
          slot,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error?.message || '添加失败'); return; }
      setTitle(''); setUrl(''); setContent('');
      await load();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm('删除这个内容块？')) return;
    await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
    await load();
  }

  async function toggleHidden(id: string, hidden: boolean) {
    await fetch('/api/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, hidden }) });
    await load();
  }

  async function setAlign(id: string, align: string) {
    await fetch('/api/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, align }) });
    await load();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === id);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    const t = arr[idx]; arr[idx] = arr[j]; arr[j] = t;
    // 更新 sort 顺序
    setItems(arr);
    for (let i = 0; i < arr.length; i++) {
      await fetch('/api/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: arr[i].id, sort: i }) });
    }
    await load();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error?.message || '上传失败'); return; }
      setUrl(d.url);
      setKind(file.type.startsWith('video/') ? 'video' : 'image');
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } finally { setUploading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, width: 'min(720px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>编辑这一页的内容</h3>
          <button className="secondary" onClick={onClose}>关闭</button>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 10 }}>添加内容块</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="标题（可空）" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
              {Object.entries(KIND_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {kind === 'text' ? (
            <textarea placeholder="文字内容…" value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 70 }} />
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder={kind === 'embed' ? '网页地址（https://…）' : kind === 'video' ? 'mp4 地址或 URL' : '图片/链接 URL'} value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
              {kind !== 'embed' && (
                <label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  {uploading ? '上传中…' : '上传文件'}
                  <input type="file" accept="video/*,image/*" style={{ display: 'none' }} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                </label>
              )}
            </div>
          )}
          <button className="primary" style={{ marginTop: 10 }} disabled={busy || uploading} onClick={add}>{busy ? '添加中…' : '添加'}</button>
          {msg ? <p style={{ color: 'var(--red)', marginTop: 8, fontSize: 13 }}>{msg}</p> : null}
        </div>

        {items.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>这一页还没有内容，添加第一个内容块吧。</p>}
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, opacity: it.hidden ? 0.55 : 1 }}>
            <span style={{ fontSize: 18 }}>{KIND_OPTIONS[it.kind] === '文字' ? '📝' : KIND_OPTIONS[it.kind] === '图片' ? '🖼️' : KIND_OPTIONS[it.kind] === '视频' ? '🎬' : KIND_OPTIONS[it.kind] === '网页' ? '🌐' : '🔗'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {it.title || '(无标题)'} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>{KIND_OPTIONS[it.kind]}</span>
                {it.hidden ? <span style={{ color: '#f87171', fontSize: 11, marginLeft: 6 }}>· 已隐藏</span> : null}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.kind === 'text' ? it.content : it.url}
              </div>
            </div>
            <button className="secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => move(it.id, -1)}>↑</button>
            <button className="secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => move(it.id, 1)}>↓</button>
            <select
              value={it.align ?? 'center'}
              onChange={(e) => setAlign(it.id, e.target.value)}
              style={{ fontSize: 11, padding: '3px 6px', width: 'auto', background: 'var(--panel2)', color: 'var(--txt)', border: '1px solid var(--border)', borderRadius: 6 }}
              title="对齐方式"
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
            <button className="secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => toggleHidden(it.id, !it.hidden)}>{it.hidden ? '显示' : '隐藏'}</button>
            <button className="danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => remove(it.id)}>删</button>
          </div>
        ))}
      </div>
    </div>
  );
}
