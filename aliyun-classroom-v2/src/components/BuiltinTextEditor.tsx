'use client';
// =========================================================
// 教师端 · 内置页文字编辑器
// 编辑内置功能页（三问/判定/揭晓/滑块/阶段/钩子…）的大屏文字，
// 保存后写入 LessonPage.overrides，大屏渲染用「覆盖值 ?? 默认值」。
// 清空某字段 = 恢复默认值。
// =========================================================
import { useEffect, useState } from 'react';
import { getFieldDefs, getBannerFields } from '@/lib/pageTextFields';

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = (page.overrides ?? {})[f.key] ?? '';
    }
    setValues(init);
  }, [page, fields.length]);

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      // 只保留非空值（空 = 恢复默认）
      const ov: Record<string, string> = {};
      for (const f of fields) {
        const v = (values[f.key] ?? '').trim();
        if (v) ov[f.key] = v;
      }
      const r = await fetch('/api/pages', {
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
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, width: 'min(640px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>改这一页的文字</h3>
          <button className="secondary" onClick={onClose}>关闭</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          填了就覆盖大屏文字；清空某一行 = 恢复默认。改完点保存立即生效。
        </p>

        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              {f.label}（默认：<span style={{ color: '#94a3b8' }}>{f.def || '（空）'}</span>）
            </label>
            <textarea
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.def || '留空用默认'}
              style={{ minHeight: f.key === 'title' || f.key === 'screenTitle' ? 56 : 76 }}
            />
          </div>
        ))}

        {msg ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{msg}</p> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          <button className="secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
