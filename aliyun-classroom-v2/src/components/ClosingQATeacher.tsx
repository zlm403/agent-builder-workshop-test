'use client';

import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { QA_QUESTIONS, QA_OUTLINES } from '@/lib/closingConfig';
import type { QAState } from '@/lib/closingQA';

const css = {
  txt: '#e2e8f0',
  sub: '#94a3b8',
  blue: '#38bdf8',
  green: '#22c55e',
  yellow: '#eab308',
  line: '#26324d',
  card: 'rgba(255,255,255,.04)',
};

interface QAPoll {
  questions: { id: string; count: number; pct: number }[];
  submitters: number;
  state: QAState;
}

export default function ClosingQATeacher({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<QAPoll | null>(null);
  const [busy, setBusy] = useState(false);

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
    const t = setInterval(load, 5000); // 每 5 秒刷新一次，排序不每秒跳动
    return () => clearInterval(t);
  }, [load]);

  const ctrl = useCallback(
    async (action: string, questionId?: string) => {
      setBusy(true);
      try {
        await fetch('/api/closing/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action, questionId }),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [sessionId, load],
  );

  if (!data) return <p style={{ color: css.sub }}>加载集中答疑数据…</p>;
  const { questions, submitters, state } = data;

  // 排序：frozenOrder 优先（讲解中锁定），否则按实时人数降序；已解答排最后
  let order = QA_QUESTIONS.map((q) => q.id);
  if (state.frozenOrder && state.frozenOrder.length) {
    const rest = order.filter((id) => !state.frozenOrder!.includes(id));
    order = [...state.frozenOrder, ...rest];
  } else {
    order = questions.slice().sort((a, b) => b.count - a.count).map((x) => x.id);
  }
  order = [
    ...order.filter((id) => !state.answered.includes(id)),
    ...order.filter((id) => state.answered.includes(id)),
  ];

  const labelOf = (id: string) => QA_QUESTIONS.find((q) => q.id === id)?.label ?? id;
  const countOf = (id: string) => questions.find((x) => x.id === id)?.count ?? 0;
  const pctOf = (id: string) => questions.find((x) => x.id === id)?.pct ?? 0;
  const active = state.activeQuestionId;

  const rowBase: CSSProperties = {
    background: css.card,
    border: `1px solid ${css.line}`,
    borderRadius: 14,
    padding: '14px 16px',
  };

  // 讲解中：展开当前问题 + 折叠其余
  if (state.status === 'explaining' && active) {
    const outline = QA_OUTLINES[active] ?? [];
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>讲解中 · 学员集中答疑</h3>
          <span style={{ fontSize: 13, color: css.sub }}>{submitters} 人已提交</span>
        </div>
        <div style={{ ...rowBase, borderColor: css.green, background: 'rgba(34,197,94,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{labelOf(active)}</div>
            <div style={{ fontSize: 13, color: css.sub, whiteSpace: 'nowrap' }}>{countOf(active)} 人 · {pctOf(active)}%</div>
          </div>
          <div style={{ fontSize: 12, color: css.yellow, fontWeight: 800, margin: '12px 0 6px' }}>讲解提纲（仅你可见）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outline.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.6 }}>
                <span style={{ color: css.yellow, fontWeight: 800 }}>{i + 1}.</span>
                <span>{o}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => ctrl('done', active)} disabled={busy} style={{ background: css.green, color: '#06210f', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
              讲完了
            </button>
            <button onClick={() => ctrl('later', active)} disabled={busy} style={{ background: 'transparent', color: css.sub, border: `1px solid ${css.line}`, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
              稍后再讲
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: css.sub, margin: '14px 0 8px' }}>其余问题（已折叠，避免分心）</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {order.filter((id) => id !== active).map((id) => (
            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: css.sub, background: css.card, border: `1px solid ${css.line}`, borderRadius: 10, padding: '8px 14px' }}>
              <span>{labelOf(id)}</span>
              <span>{state.answered.includes(id) ? '已解答' : `${countOf(id)} 人`}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 排行榜态
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, margin: 0 }}>学员集中答疑</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: css.sub }}>{submitters} 人已提交</span>
          {state.frozenOrder && (
            <button onClick={() => ctrl('unlock')} disabled={busy} style={{ background: 'transparent', color: css.sub, border: `1px solid ${css.line}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              解锁排名
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {order.map((id, i) => {
          const answered = state.answered.includes(id);
          return (
            <div key={id} style={{ ...rowBase, opacity: answered ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: css.blue, minWidth: 22 }}>{i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{labelOf(id)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 13, color: css.sub }}>{countOf(id)} 人 · {pctOf(id)}%</span>
                  {answered ? (
                    <span style={{ fontSize: 12, color: css.green, border: `1px solid rgba(34,197,94,.4)`, borderRadius: 999, padding: '2px 10px' }}>已解答</span>
                  ) : (
                    <button onClick={() => ctrl('present', id)} disabled={busy} style={{ background: css.blue, color: '#04263a', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                      我要讲这个
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: css.sub, marginTop: 12, lineHeight: 1.6 }}>
        点击「我要讲这个」后，大屏切换到对应解答画面、本题排名锁定；讲完点「讲完了」自动回到排行榜并标记已解答。优先讲前 3–5 个，其余问题学生可在手机端查看预制答案。
      </p>
    </div>
  );
}
