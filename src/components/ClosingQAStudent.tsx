'use client';

import { useEffect, useState, useCallback } from 'react';
import { QA_QUESTIONS, QA_LAYOUTS } from '@/lib/closingConfig';
import type { QAState } from '@/lib/closingQA';
import QALayoutView from '@/components/QALayoutView';

const css = {
  card: '#16213a',
  line: '#26324d',
  txt: '#e2e8f0',
  sub: '#94a3b8',
  blue: '#38bdf8',
  green: '#22c55e',
  yellow: '#eab308',
};

interface QAPoll {
  questions: { id: string; count: number; pct: number }[];
  submitters: number;
  state: QAState;
}

export default function ClosingQAStudent({ sessionId, anon }: { sessionId: string; anon: string }) {
  const [data, setData] = useState<QAPoll | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openAnswer, setOpenAnswer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/closing/qa?sessionId=${encodeURIComponent(sessionId)}`);
      const d = await r.json();
      if (d && Array.isArray(d.questions)) setData(d);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  // 还原本地已选（允许答疑开始前修改）
  useEffect(() => {
    const saved = localStorage.getItem('qaVote:' + sessionId);
    if (saved) {
      try {
        const arr = JSON.parse(saved) as string[];
        setSelected(arr);
        setDone(true);
      } catch {
        /* ignore */
      }
    }
  }, [sessionId]);

  const locked = data?.state.status !== 'idle';

  const toggle = (id: string) => {
    if (done || locked) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const submit = async () => {
    if (selected.length === 0 || locked) return;
    setBusy(true);
    try {
      await fetch('/api/closing/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'vote', anonymousId: anon, selected }),
      });
      setDone(true);
      localStorage.setItem('qaVote:' + sessionId, JSON.stringify(selected));
    } finally {
      setBusy(false);
    }
  };

  const labelOf = (id: string) => QA_QUESTIONS.find((q) => q.id === id)?.label ?? id;

  return (
    <div style={{ background: css.card, border: `1px solid ${css.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>我现在最想确认什么？</div>
      <div style={{ fontSize: 13, color: css.sub, marginBottom: 12 }}>
        请勾选我还有疑问的内容，讲师会优先回答大家选得最多的问题。
        {locked ? '（集中答疑已开始，不可再修改）' : ''}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {QA_QUESTIONS.map((q) => {
          const checked = selected.includes(q.id);
          const disabled = locked || done;
          return (
            <label
              key={q.id}
              style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !checked ? 0.4 : 1, fontSize: 14,
                background: checked ? 'rgba(56,189,248,.08)' : 'transparent',
                border: `1px solid ${checked ? css.blue : css.line}`, borderRadius: 10, padding: '10px 12px',
              }}
            >
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(q.id)} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{q.label}</span>
            </label>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          onClick={submit}
          disabled={locked || busy || done || selected.length === 0}
          style={{
            background: done ? css.green : css.blue, color: '#04263a', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            opacity: locked || busy || done || selected.length === 0 ? 0.5 : 1,
          }}
        >
          {done ? '已提交' : '提交我的疑问'}
        </button>
      </div>

      {done && (
        <div style={{ marginTop: 12, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, color: css.green, marginBottom: 4 }}>已提交</div>
          {selected.length > 0 ? (
            <div style={{ marginBottom: 4 }}>你选择了：<br />{selected.map((id) => `• ${labelOf(id)}`).join('\n')}</div>
          ) : (
            <div style={{ marginBottom: 4 }}>你暂未选择任何疑问。</div>
          )}
          <div style={{ color: css.sub }}>
            {locked ? '集中答疑进行中…' : `当前有 ${data?.submitters ?? 0} 人正在等待集中答疑`}
          </div>
        </div>
      )}

      {/* 手机端查看全部预制答案（排名靠后的问题也可见） */}
      <div style={{ marginTop: 14 }}>
        <button
          onClick={() => setOpenAnswer(openAnswer ? null : '__all__')}
          style={{ background: 'transparent', color: css.blue, border: `1px solid ${css.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', width: '100%' }}
        >
          {openAnswer ? '收起全部问题解答 ▲' : '查看全部问题解答 ▼'}
        </button>
        {openAnswer && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {QA_QUESTIONS.map((q) => {
              const layout = QA_LAYOUTS[q.id];
              const open = openAnswer === q.id || openAnswer === '__all__';
              return (
                <div key={q.id} style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${css.line}`, borderRadius: 12, padding: 12 }}>
                  <button
                    onClick={() => setOpenAnswer(open ? '__all__' : q.id)}
                    style={{ background: 'transparent', border: 'none', color: css.txt, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    {open ? '▾' : '▸'} {q.label}
                  </button>
                  {open && layout && (
                    <div style={{ marginTop: 10 }}>
                      <QALayoutView layout={layout} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
