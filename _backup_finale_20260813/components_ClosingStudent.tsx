'use client';

import { useEffect, useState } from 'react';
import { CLOSING_BEATS, CLOSING_QUESTIONS } from '@/lib/closingConfig';
import ClosingQAStudent from '@/components/ClosingQAStudent';

const css = {
  bg: '#0f172a',
  card: '#16213a',
  line: '#26324d',
  txt: '#e2e8f0',
  sub: '#94a3b8',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#38bdf8',
};

function getAnon(): string {
  let v = localStorage.getItem('closingAnonId');
  if (!v) {
    v = 'C' + Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem('closingAnonId', v);
  }
  return v;
}

export default function ClosingStudent({ beatIdx = 0, sessionId: incomingSessionId = '', anon: incomingAnon }: { beatIdx?: number; sessionId?: string; anon?: string }) {
  const [sessionId, setSessionId] = useState(incomingSessionId);
  const [anon, setAnon] = useState(incomingAnon ?? '');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [single, setSingle] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSessionId((prev) => incomingSessionId || prev);
    setAnon((prev) => incomingAnon || prev || getAnon());
  }, [incomingSessionId, incomingAnon]);

  const beat = CLOSING_BEATS[beatIdx] ?? CLOSING_BEATS[0];
  const beatKey = beat.key;

  const postAnswer = async (questionId: string, text: string) => {
    if (!sessionId) return;
    try {
      await fetch('/api/closing/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, anonymousId: anon, name: null, questionId, text }),
      });
    } catch {
      /* ignore */
    }
  };

  const toggleMulti = (qid: string, opt: string) => {
    if (submitted) return;
    setMulti((prev) => {
      const cur = prev[qid] ?? [];
      const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
      return { ...prev, [qid]: next };
    });
  };

  const selectSingle = (qid: string, opt: string) => {
    if (submitted) return;
    setSingle((prev) => ({ ...prev, [qid]: opt }));
  };

  const hasAnswer = CLOSING_QUESTIONS.some((q) => {
    if (q.type === 'text') return !!(texts[q.id] ?? '').trim();
    if (q.type === 'multi') return (multi[q.id] ?? []).length > 0;
    const s = single[q.id] ?? '';
    if (!s) return false;
    if (s.startsWith('其他')) return !!otherText.trim();
    return true;
  });

  const submitSurvey = () => {
    if (submitted || !hasAnswer) return;
    CLOSING_QUESTIONS.forEach((q) => {
      if (q.type === 'text') {
        const v = (texts[q.id] ?? '').trim();
        if (v) postAnswer(q.id, v);
      } else if (q.type === 'multi') {
        const v = (multi[q.id] ?? []).join('；');
        if (v) postAnswer(q.id, v);
      } else {
        const s = single[q.id] ?? '';
        if (s) postAnswer(q.id, s.startsWith('其他') ? otherText.trim() || '其他' : s);
      }
    });
    setSubmitted(true);
  };

  // ============ 页面 2 · 集中答疑投票（仅在 qa 环节） ============
  if (beatKey === 'qa') {
    return (
      <div style={{ minHeight: '100vh', background: css.bg, color: css.txt, padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <ClosingQAStudent sessionId={sessionId} anon={anon} />
      </div>
    );
  }

  // ============ 中间环节 · 听课中（被动） ============
  if (beatKey === 'course' || beatKey === 'platform' || beatKey === 'price' || beatKey === 'summary') {
    return (
      <div style={{ minHeight: '100vh', background: css.bg, color: css.txt, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: css.card, border: `1px solid ${css.line}`, borderRadius: 16, padding: 28, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>请听讲师讲解</div>
          <div style={{ fontSize: 14, color: css.sub, lineHeight: 1.8 }}>
            完整内容正在大屏讲解，专注听讲即可，无需在手机上操作。
            {beat.studentHint ? <div style={{ marginTop: 12, color: css.txt }}>{beat.studentHint}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  // ============ 页面 1 · 三问（need / solution 环节） ============
  return (
    <div style={{ minHeight: '100vh', background: css.bg, color: css.txt, padding: 16, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>学生端</div>
        <div style={{ fontSize: 12, color: css.sub, border: `1px solid ${css.line}`, padding: '2px 8px', borderRadius: 20 }}>试听课 · 最后 30 分钟</div>
      </div>

      <div style={{ fontSize: 13, color: css.sub, marginBottom: 16, lineHeight: 1.7 }}>
        匿名提交，无需填写姓名。提交后不可修改，专心看大屏即可。
      </div>

      {CLOSING_QUESTIONS.map((q) => {
        const disabled = submitted;
        return (
          <div key={q.id} style={{ background: css.card, border: `1px solid ${css.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              {q.q}
              {q.type === 'multi' ? (
                <span style={{ marginLeft: 8, fontSize: 12, color: css.sub, fontWeight: 400 }}>多选，不限项数</span>
              ) : q.type === 'single' ? (
                <span style={{ marginLeft: 8, fontSize: 12, color: css.sub, fontWeight: 400 }}>单选</span>
              ) : null}
            </div>

            {q.type === 'text' && (
              <textarea
                value={texts[q.id] ?? ''}
                disabled={disabled}
                placeholder="请用「帮助谁 + 解决什么问题」描述，不需要使用专业名词。"
                onChange={(e) => setTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                style={{ width: '100%', minHeight: 84, background: '#0e1729', border: `1px solid ${css.line}`, borderRadius: 10, color: css.txt, fontSize: 14, padding: 10, outline: 'none', resize: 'vertical', opacity: disabled ? 0.6 : 1 }}
              />
            )}

            {q.type === 'multi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(q.options ?? []).map((opt) => {
                  const checked = (multi[q.id] ?? []).includes(opt);
                  return (
                    <label
                      key={opt}
                      style={{
                        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1, fontSize: 14,
                        background: checked ? 'rgba(56,189,248,.08)' : 'transparent',
                        border: `1px solid ${checked ? css.blue : css.line}`, borderRadius: 10, padding: '10px 12px',
                      }}
                    >
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleMulti(q.id, opt)} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === 'single' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(q.options ?? []).map((opt) => {
                  const checked = (single[q.id] ?? '') === opt;
                  const isOther = opt.startsWith('其他');
                  return (
                    <label
                      key={opt}
                      style={{
                        display: isOther ? 'block' : 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1, fontSize: 14,
                        background: checked ? 'rgba(56,189,248,.08)' : 'transparent',
                        border: `1px solid ${checked ? css.blue : css.line}`, borderRadius: 10, padding: '10px 12px',
                      }}
                    >
                      <input type="radio" name={q.id} checked={checked} disabled={disabled} onChange={() => selectSingle(q.id, opt)} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>{opt}</span>
                      {isOther && checked && (
                        <input
                          type="text"
                          value={otherText}
                          disabled={disabled}
                          placeholder="请描述你最大的困难"
                          onChange={(e) => setOtherText(e.target.value)}
                          style={{ display: 'block', width: '100%', minHeight: 48, marginTop: 10, background: '#0e1729', border: `1px solid ${css.line}`, borderRadius: 10, color: css.txt, fontSize: 14, padding: 10, outline: 'none' }}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={submitSurvey}
        disabled={submitted || !hasAnswer}
        style={{
          width: '100%', background: submitted ? css.green : css.blue, color: '#04263a', border: 'none',
          borderRadius: 10, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          opacity: submitted || !hasAnswer ? 0.5 : 1,
        }}
      >
        {submitted ? '已提交' : '提交'}
      </button>

      {submitted && (
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: css.green }}>
          已提交 · 感谢，请专注看大屏
        </div>
      )}
    </div>
  );
}
