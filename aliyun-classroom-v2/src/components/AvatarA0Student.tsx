'use client';
// =========================================================
// A0 新版 · 学生端组件（覆盖 A0-1 三问 / A0-2 关系题 / A0-3 揭晓等待）
// =========================================================
import { useEffect, useState } from 'react';
import { A0_QUESTIONS, A0_VOTE_OPTIONS } from '@/features/avatarLesson/config';

export default function AvatarA0Student({
  type,
  anonymousId,
  sessionId,
  locked,
  moduleStatus,
  submitted,
  onSubmitted,
  currentTitle,
}: {
  type: string; // A0N_QUESTIONS | A0N_VOTE | A0N_REVEAL
  anonymousId: string;
  sessionId: string;
  locked: boolean;
  moduleStatus: string;
  submitted: boolean;
  onSubmitted: () => void;
  currentTitle?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [relation, setRelation] = useState<'tool' | 'partner' | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // 恢复已提交内容
  useEffect(() => {
    if (submitted && moduleStatus === 'submitted') {
      // 已提交则显示完成态
    }
  }, [submitted, moduleStatus]);

  const qs = A0_QUESTIONS;
  const options = A0_VOTE_OPTIONS;

  async function submitQuestions() {
    const filled = qs.every((q) => (answers[q.key] ?? '').trim().length > 0);
    if (!filled || busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/avatar/a0/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, answers }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error?.code === 'MODULE_LOCKED' ? '本环节已截止/锁定' : '提交失败');
        return;
      }
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  async function submitVote() {
    if (!relation || busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/avatar/a0/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, relation }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error?.code === 'MODULE_LOCKED' ? '本环节已截止/锁定' : '提交失败');
        return;
      }
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  // 三问
  if (type === 'A0N_QUESTIONS') {
    return (
      <div>
        <p className="task-prompt" style={{ color: '#fbbf24', fontWeight: 600 }}>
          请按真实想法回答这三个问题——没有对错，它只用来认识"你和 AI"的关系。
        </p>
        {qs.map((q, i) => (
          <div key={q.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>{i + 1}. {q.title}</label>
            <textarea
              placeholder={q.placeholder}
              value={answers[q.key] ?? ''}
              disabled={busy || locked || submitted}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
              style={{ minHeight: 80 }}
            />
          </div>
        ))}
        {submitted ? (
          <p className="note" style={{ color: 'var(--green)' }}>已提交三问，等待教师推进到「关系题投票」。</p>
        ) : (
          <>
            <button disabled={busy || locked || qs.some((q) => !(answers[q.key] ?? '').trim())} onClick={submitQuestions} className="primary" style={{ width: '100%' }}>
              {busy ? '提交中…' : '提交三问'}
            </button>
            {msg ? <p style={{ color: 'var(--red)', marginTop: 8 }}>{msg}</p> : null}
          </>
        )}
      </div>
    );
  }

  // 关系题投票
  if (type === 'A0N_VOTE') {
    return (
      <div>
        <p className="task-prompt" style={{ color: '#fbbf24', fontWeight: 600 }}>
          最后做一次唯一选择：在你的生活里，AI 更像是你的——
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 8 }}>
          {options.map((o) => {
            const active = relation === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={locked || submitted}
                onClick={() => setRelation(o.id)}
                style={{
                  textAlign: 'left', padding: '16px 18px', borderRadius: 14, cursor: 'pointer',
                  border: active ? '2px solid var(--purple)' : '1px solid var(--border)',
                  background: active ? 'rgba(124,58,237,0.16)' : 'var(--panel)',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontSize: 22 }}>{o.icon} <b style={{ fontSize: 17 }}>{o.label}</b></div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{o.desc}</div>
              </button>
            );
          })}
        </div>
        {submitted ? (
          <p className="note" style={{ color: 'var(--green)', marginTop: 12 }}>已投票，稍后看大屏揭晓全班结果。</p>
        ) : (
          <>
            <button disabled={busy || locked || !relation} onClick={submitVote} className="primary" style={{ width: '100%', marginTop: 14 }}>
              {busy ? '提交中…' : '确认投票'}
            </button>
            {msg ? <p style={{ color: 'var(--red)', marginTop: 8 }}>{msg}</p> : null}
          </>
        )}
      </div>
    );
  }

  // A0-3 揭晓等待：请看大屏
  return (
    <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
      <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
      <p className="note">老师正在揭晓全班的答案，并讲解「过去 vs 未来」的流程差异。跟着大屏一起看。</p>
    </div>
  );
}
