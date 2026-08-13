'use client';
// =========================================================
// 教师端 · 环节内容块就近管理（环节操作区下方使用）
// 对当前模块的所有插入位置（slot），列出已插入的内容块：
//   - 隐藏：大屏/学生端不渲染，保留在库可恢复
//   - 删除：直接删除
//   - 增加：打开媒体库弹窗，预选该 slot
// 相当于媒体库的"就近操作"版，按当前环节筛选。
// =========================================================
import { useCallback, useEffect, useState } from 'react';
import { CONTENT_SLOTS } from '@/lib/slots';

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  url?: string | null;
  content?: string | null;
  slot: string;
  sort: number;
  hidden?: boolean;
}

const KIND_ICONS: Record<string, string> = { text: '📝', image: '🖼️', video: '🎬', link: '🔗' };
const KIND_LABELS: Record<string, string> = { text: '文字', image: '图片', video: '视频', link: '链接' };

// 模块 → 内容槽分组（与 slots.ts 的 group 对应）
export const MODULE_SLOT_GROUP: Record<string, string> = {
  A0N_QUESTIONS: 'A0',
  A0N_VOTE: 'A0',
  A0N_REVEAL: 'A0',
  A1_AVATAR: '数字分身',
  P2_SITE: '快速入门网站',
  P3_GAME: '养成游戏',
  A08_WRAP: '收官',
  finale: '收官',
};

export default function SlotContentManager({
  moduleId,
  onAdd,
}: {
  moduleId: string;
  onAdd: (slot: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const group = MODULE_SLOT_GROUP[moduleId] ?? null;
  const slots = group ? CONTENT_SLOTS.filter((s) => s.group === group) : [];

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/media?includeHidden=1');
      const d = await r.json();
      if (d.items) setItems(d.items);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!group || slots.length === 0) return null;

  const bySlot: Record<string, MediaItem[]> = {};
  for (const s of slots) bySlot[s.key] = [];
  for (const it of items) if (it.slot in bySlot) bySlot[it.slot].push(it);

  async function toggleHidden(id: string, hidden: boolean) {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hidden }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm('删除这个内容块？')) return;
    await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div style={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: 12, padding: 10, background: 'rgba(15,23,42,0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>本环节内容块</span>
        <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => onAdd(slots[0]?.key ?? '')}>
          ＋ 增加内容
        </button>
      </div>

      {slots.map((s) => {
        const list = bySlot[s.key] ?? [];
        const isEmpty = list.length === 0;
        return (
          <div key={s.key} style={{ marginBottom: 8, paddingLeft: 4, borderLeft: '2px solid rgba(124,58,237,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 600 }}>{s.label}</span>
              <button className="secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAdd(s.key)}>＋ 在此处增加</button>
            </div>
            {isEmpty && (
              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 8px', marginBottom: 4 }}>（暂无内容，点「在此处增加」添加）</div>
            )}
            {list.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 4, opacity: it.hidden ? 0.5 : 1 }}>
                <span style={{ fontSize: 13 }}>{KIND_ICONS[it.kind] ?? '📦'}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.title}
                  {it.hidden ? <span style={{ color: '#f87171', fontSize: 10, marginLeft: 6 }}>· 已隐藏</span> : null}
                </span>
                <button className="secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => toggleHidden(it.id, !it.hidden)}>
                  {it.hidden ? '显示' : '隐藏'}
                </button>
                <button className="danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => remove(it.id)}>删除</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
