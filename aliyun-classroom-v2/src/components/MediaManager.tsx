'use client';
// =========================================================
// 教师端 · 课堂内容框架管理（文字/图片/视频/链接）
// 支持：添加（填内容 / 填URL / 上传文件）、AI 生成、删除、按 slot 插槽归类
// =========================================================
import { useCallback, useEffect, useState } from 'react';
import { slotLabel } from '@/lib/slots';

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  content?: string | null;
  slot: string;
  sort: number;
  hidden?: boolean;
  createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
  text: '文字',
  image: '图片',
  video: '视频',
  link: '链接',
};

const KIND_ICONS: Record<string, string> = {
  text: '📝',
  image: '🖼️',
  video: '🎬',
  link: '🔗',
};

// 动态插入位置（来自 /api/pages/slots：命名 slot + 内容页 page:{id}）
interface SlotOption {
  key: string;
  label: string;
  kind: 'named' | 'page';
}
interface SlotGroup {
  group: string;
  name: string;
  slots: SlotOption[];
}

export default function MediaManager({ onClose, initialSlot }: { onClose: () => void; initialSlot?: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [slotGroups, setSlotGroups] = useState<SlotGroup[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [slot, setSlot] = useState(initialSlot ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  // AI 生成
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mediaR, slotsR] = await Promise.all([
        fetch('/api/media?includeHidden=1'),
        fetch('/api/pages/slots'),
      ]);
      const d = await mediaR.json();
      const sd = await slotsR.json();
      if (d.items) setItems(d.items);
      if (sd.groups) setSlotGroups(sd.groups);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 默认选中第一个可用插入位置（未传 initialSlot 时）
  useEffect(() => {
    if (slot || slotGroups.length === 0) return;
    const first = slotGroups.find((g) => g.slots.length > 0)?.slots[0];
    if (first) setSlot(first.key);
  }, [slot, slotGroups]);

  async function add() {
    if (!title.trim()) { setMsg('请填写标题'); return; }
    if (kind === 'text' && !content.trim()) { setMsg('文字内容不能为空'); return; }
    if (kind !== 'text' && !url.trim()) { setMsg('请填写地址或上传文件'); return; }
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), kind, url: url.trim() || undefined, content: content.trim() || undefined, slot }),
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
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hidden }),
    });
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

  async function aiGenerate() {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/media/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), slot }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error?.message || 'AI 生成失败'); return; }
      // AI 返回的内容块填入表单，供老师确认后插入
      if (d.title) setTitle(d.title);
      if (d.kind) setKind(d.kind);
      if (d.content) setContent(d.content || '');
      if (d.url) setUrl(d.url || '');
      setMsg('AI 已生成，确认内容后点「插入」。');
    } finally { setAiBusy(false); }
  }

  const bySlot: Record<string, MediaItem[]> = {};
  for (const it of items) (bySlot[it.slot] ??= []).push(it);
  const slotKeys = Object.keys(bySlot).sort();

  // 插入位置 label 查询：优先动态 API（含内容页 page:{id}），回退 slots.ts 命名 slot
  const slotLabelMap: Record<string, string> = {};
  for (const g of slotGroups) for (const s of g.slots) slotLabelMap[s.key] = s.label;
  const labelOf = (key: string) => slotLabelMap[key] ?? slotLabel(key);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, width: 'min(820px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>课堂内容框架</h3>
          <button className="secondary" onClick={onClose}>关闭</button>
        </div>

        {/* 添加内容块 */}
        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 10 }}>添加内容块</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="标题（如：普通人的例子）" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {kind === 'text' ? (
              <textarea placeholder="文字内容…" value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 70 }} />
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder={kind === 'video' ? 'mp4 地址或 URL' : '图片/链接 URL'} value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
                <label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  {uploading ? '上传中…' : '上传文件'}
                  <input type="file" accept="video/*,image/*" style={{ display: 'none' }} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>插入位置：</label>
              <select value={slot} onChange={(e) => setSlot(e.target.value)} style={{ width: 'auto', flex: 1 }}>
                {slotGroups.map((g) => (
                  <optgroup key={g.group} label={g.name}>
                    {g.slots.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button className="primary" disabled={busy || uploading} onClick={add}>{busy ? '添加中…' : '插入'}</button>
            </div>
          </div>
          {msg ? <p style={{ color: msg.startsWith('AI') ? '#fde047' : msg.startsWith('请') ? '#fde047' : 'var(--red)', marginTop: 8, fontSize: 13 }}>{msg}</p> : null}
        </div>

        {/* AI 辅助生成 */}
        <div style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 8 }}>🤖 对 AI 说，让它帮你做</div>
          <textarea
            placeholder="例：在当前位置加一句鼓励的话：恭喜大家，你们已经学会和 AI 一起做事了！"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            style={{ minHeight: 54 }}
          />
          <button className="secondary" style={{ marginTop: 8 }} disabled={aiBusy || !aiPrompt.trim()} onClick={aiGenerate}>
            {aiBusy ? 'AI 生成中…' : '✨ 让 AI 生成'}
          </button>
        </div>

        {/* 列表 */}
        {slotKeys.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>还没有内容块，先添加一个吧。</p>}
        {slotKeys.map((sk) => (
          <div key={sk} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{labelOf(sk)}（{bySlot[sk].length}）</div>
            {bySlot[sk].map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, opacity: it.hidden ? 0.55 : 1 }}>
                <span style={{ fontSize: 18 }}>{KIND_ICONS[it.kind] ?? '📦'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {it.title} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>{KIND_LABELS[it.kind]}</span>
                    {it.hidden ? <span style={{ color: '#f87171', fontSize: 11, marginLeft: 6 }}>· 已隐藏</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.kind === 'text' ? it.content : it.url}
                  </div>
                </div>
                {it.url && <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#93c5fd' }}>预览</a>}
                <button
                  className="secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => toggleHidden(it.id, !it.hidden)}
                >
                  {it.hidden ? '显示' : '隐藏'}
                </button>
                <button className="danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => remove(it.id)}>删</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
