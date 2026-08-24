'use client';
// =========================================================
// 教师端 · 内置页文字编辑器
// 编辑内置功能页（三问/判定/揭晓/滑块/阶段/钩子…）的大屏文字，
// 保存后写入 LessonPage.overrides，大屏渲染用「覆盖值 ?? 默认值」。
// 三种操作：
//   - 填文字 = 覆盖默认
//   - 清空 = 恢复默认
//   - 点「删除这行」= 这一行不显示（overrides 值为 REMOVED）
// =========================================================
import { useEffect, useState } from 'react';
import { getFieldDefs, getBannerFields } from '@/lib/pageTextFields';
import { api } from '@/lib/basePath';
import { REMOVED } from '@/lib/usePageText';

interface PageDef {
  id: string;
  kind: string;
  refKey: string | null;
  overrides?: Record<string, string> | null;
  title?: string | null;
}

export default function BuiltinTextEditor({ page, onClose, onSaved }: { page: PageDef; onClose: () => void; onSaved: () => void }) {
  const fields = [...getFieldDefs(page.refKey), ...getBannerFields(page.refKey)];
  const [values, setValues] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const init: Record<string, string> = {};
    const rm: Record<string, boolean> = {};
    for (const f of fields) {
      const v = (page.overrides ?? {})[f.key];
      if (v === REMOVED) {
        rm[f.key] = true;
        init[f.key] = '';
      } else {
        init[f.key] = v ?? '';
      }
    }
    setValues(init);
    setRemoved(rm);
  }, [page, fields.length]);

  function toggleRemove(key: string) {
    setRemoved((r) => ({ ...r, [key]: !r[key] }));
  }

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const ov: Record<string, string> = {};
      for (const f of fields) {
        if (removed[f.key]) {
          ov[f.key] = REMOVED;
        } else {
          const v = (values[f.key] ?? '').trim();
          if (v) ov[f.key] = v;
        }
      }
      const r = await fetch(api('/api/pages'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: page.id, overrides: ov }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error?.message || '保存失败'); return; }
      onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  if (fields.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, width: 'min(520px, 94vw)' }}>
          <h3 style={{ margin: '0 0 12px' }}>这一页没有可编辑文字</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>它是一张功能页（如共生缸画面），文字由系统生成，暂不支持编辑。</p>
          <button className="secondary" onClick={onClose} style={{ marginTop: 12 }}>关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, width: 'min(660px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>改这一页的文字</h3>
          <button className="secondary" onClick={onClose}>关闭</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          填字 = 覆盖默认；清空 = 恢复默认；点「删除这行」= 这行不显示。改完点保存立即生效。
        </p>

        {fields.map((f) => {
          const isRemoved = removed[f.key] === true;
          return (
            <div key={f.key} style={{ marginBottom: 14, opacity: isRemoved ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {f.label}（默认：<span style={{ color: '#94a3b8' }}>{f.def || '（空）'}</span>）
                </span>
                <button
                  className={isRemoved ? 'primary' : 'secondary'}
                  style={{ fontSize: 11, padding: '2px 10px', marginLeft: 'auto' }}
                  onClick={() => toggleRemove(f.key)}
                  title={isRemoved ? '恢复显示这一行' : '删除这一行（大屏不显示）'}
                >
                  {isRemoved ? '↩ 恢复显示' : '🗑 删除这行'}
                </button>
              </div>
              {isRemoved && (
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 4 }}>已删除（大屏/学生屏不显示这一行）</div>
              )}
              {!isRemoved && (
                <textarea
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.def || '留空用默认'}
                  style={{ minHeight: f.key === 'title' || f.key === 'screenTitle' ? 56 : 76 }}
                />
              )}
            </div>
          );
        })}

        {msg ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{msg}</p> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          <button className="secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
