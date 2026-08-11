'use client';

import { useEffect, useState } from 'react';
import { QA_QUESTIONS, QA_LAYOUTS } from '@/lib/closingConfig';
import type { QAState } from '@/lib/closingQA';
import QALayoutView from '@/components/QALayoutView';

const css = {
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

// 大屏解答层：仅当讲师点「我要讲这个」且处于讲解中时，全屏覆盖显示对应解答画面。
// 其余时间返回 null，大屏仍显示收官常规内容（不给学生看完整排行榜）。
export default function ClosingQAScreen({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<QAPoll | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/closing/qa?sessionId=${encodeURIComponent(sessionId)}`);
        const d = await r.json();
        if (d && Array.isArray(d.questions)) setData(d);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 1500); // 1.5s 轮询，保证讲师点击后大屏及时切换
    return () => clearInterval(t);
  }, [sessionId]);

  if (!data) return null;
  const { state, questions } = data;
  if (state.status !== 'explaining' || !state.activeQuestionId) return null;

  const q = QA_QUESTIONS.find((x) => x.id === state.activeQuestionId);
  const layout = QA_LAYOUTS[state.activeQuestionId];
  const count = questions.find((x) => x.id === state.activeQuestionId)?.count ?? 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'radial-gradient(1400px 700px at 50% -10%,#13203a,#0b1120 60%)',
      color: css.txt,
      padding: '48px 56px',
      overflowY: 'auto',
      fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.5, color: css.yellow, marginBottom: 16 }}>
        大家最关心的问题 TOP {state.rank}
      </div>
      <h1 style={{ fontSize: 40, lineHeight: 1.35, marginBottom: 14, maxWidth: 1100 }}>{q?.label}</h1>
      <div style={{ fontSize: 18, color: css.sub, marginBottom: 28 }}>
        <b style={{ color: css.green, fontSize: 22 }}>{count}</b> 人也在关心
      </div>
      <div style={{ maxWidth: 1100 }}>{layout ? <QALayoutView layout={layout} /> : null}</div>
    </div>
  );
}
