'use client';
// =========================================================
// A1 数字分身 · 学生端组件（六步连续对话）
// 手机端：一个连续对话框，不停地问、不停地说。
// 大屏端：六格点亮由教师控制，与手机端解耦。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { A1_STEPS, A1_PLANS } from '@/features/avatarLesson/config';

interface Bubble {
  role: 'ai' | 'user';
  content: string;
}

interface SkillCard {
  labels?: string[];
  traits?: string;
  boundaries?: string;
  focus?: string;
}

export default function AvatarA1Student({
  anonymousId,
  sessionId,
  locked,
}: {
  anonymousId: string;
  sessionId: string;
  locked: boolean;
}) {
  const [stepIdx, setStepIdx] = useState(0); // 0..5
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [skill, setSkill] = useState<{ skill: string; profile: SkillCard } | null>(null);
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState('');
  const [drafts, setDrafts] = useState<{ id: string; text: string }[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [finalText, setFinalText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const step = A1_STEPS[stepIdx];

  // 加载已保存状态
  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/avatar/a1/state?sessionId=${sessionId}&anonymousId=${anonymousId}`);
        const d = await res.json();
        if (d.chatLog && Array.isArray(d.chatLog)) {
          setBubbles(d.chatLog.filter((m: any) => m.role === 'ai' || m.role === 'user'));
        }
        if (d.skill) setSkill({ skill: d.skill, profile: d.profile });
        if (d.task) setTask(d.task);
        if (d.plan) setPlan(d.plan);
        if (d.drafts && Array.isArray(d.drafts)) setDrafts(d.drafts);
        if (d.feedback) setFeedback(d.feedback);
        if (d.finalText) setFinalText(d.finalText);
        if (d.submittedAt) setSubmitted(true);
        // 恢复步骤位置：route 已保证 step=当前步(1..6)，直接 step-1 即可；
        // 仅用成果物把「已选方案/已生成三版/已提交」推进到 iterate(5)。
        const s = Math.min(6, Math.max(1, Number(d.step) || 1));
        if (d.finalText || d.submittedAt) setStepIdx(5);
        else if (d.drafts) setStepIdx(5);
        else if (d.plan) setStepIdx(5);
        else setStepIdx(s - 1);
        // 初始进入，追加 AI 开场
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: A1_STEPS[0].aiAsk }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, drafts, feedback, skill]);

  async function send() {
    const text = input.trim();
    if (!text || busy || locked) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stepKey: step.key, message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
      if (step.key === 'build' && d.done) {
        // 创建分身完成：生成画像+Skill，切到任务步（stepIdx 2→3）
        setStepIdx(3);
        setBubbles((b) => [...b, { role: 'ai', content: A1_STEPS[3].aiAsk }]);
        const sres = await fetch('/api/avatar/a1/skill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymousId, sessionId }),
        });
        const sd = await sres.json();
        if (sd.skill) {
          setSkill({ skill: sd.skill, profile: sd.profile });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function goNextStep() {
    if (stepIdx >= 5) return;
    const ni = stepIdx + 1;
    const oldStep = step.key;
    setStepIdx(ni);
    setBusy(true);
    try {
      // 通过聊天接口推进，让 DB step 同步（刷新后能恢复到正确步骤），AI 会引导下一步
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stepKey: oldStep, message: '我准备好了，进入下一步。' }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
      else setBubbles((b) => [...b, { role: 'ai', content: A1_STEPS[ni].aiAsk }]);
    } catch {
      setBubbles((b) => [...b, { role: 'ai', content: A1_STEPS[ni].aiAsk }]);
    } finally {
      setBusy(false);
    }
  }

  function insertSkill() {
    if (!skill) return;
    setInput((v) => (v ? v + '\n\n' : '') + skill.skill);
  }

  async function generateDrafts() {
    if (busy || !plan) return;
    setBusy(true);
    try {
      const res = await fetch('/api/avatar/a1/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'generate' }),
      });
      const d = await res.json();
      if (d.drafts) setDrafts(d.drafts);
    } finally {
      setBusy(false);
    }
  }

  async function judgePicked() {
    if (busy || !picked) return;
    const draft = drafts?.find((x) => x.id === picked);
    if (!draft) return;
    setBusy(true);
    setFinalText(draft.text);
    try {
      const res = await fetch('/api/avatar/a1/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'judge', finalText: draft.text }),
      });
      const d = await res.json();
      setFeedback(d.note || '');
      setBubbles((b) => [...b, { role: 'user', content: draft.text }, { role: 'ai', content: d.note || '' }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitFinal() {
    if (busy || !finalText) return;
    setBusy(true);
    try {
      const res = await fetch('/api/avatar/a1/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, finalText }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="note">正在加载你的数字分身…</p>;
  }

  const planOk = plan || !['plan', 'iterate'].includes(step.key);

  return (
    <div className="ai-workspace">
      <div className="zone">
        <h3 style={{ color: '#c4b5fd' }}>
          A1 数字分身 · {step.name}
          <span style={{ float: 'right', fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
            {stepIdx + 1} / {A1_STEPS.length}
          </span>
        </h3>
        <p className="task-hint" style={{ color: '#bae6fd', lineHeight: 1.6, margin: '6px 0 0' }}>{step.title}</p>
      </div>

      <div className="zone ai-zone">
        <h3>{stepIdx === 5 ? '和 AI 一起打磨作品' : '和数字分身教练对话'}</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}

          {/* 技能卡（步3完成后出现 · 引用） */}
          {skill && (stepIdx === 2 || stepIdx === 3) && (
            <div className="skill-card" style={{ marginTop: 10, padding: 14, borderRadius: 12, background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.4)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 8 }}>🧠 你的数字分身 · Skill 卡</div>
              {skill.profile?.labels?.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {skill.profile.labels.map((l, i2) => (
                    <span key={i2} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>{l}</span>
                  ))}
                </div>
              ) : null}
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>{skill.skill}</pre>
              <button className="secondary" style={{ marginTop: 10 }} onClick={insertSkill}>📎 引用这份 Skill 到对话框</button>
            </div>
          )}

          {/* 方案选择（步4选择） */}
          {step.key === 'plan' && !plan && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
              {Object.values(A1_PLANS).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="secondary"
                  style={{ textAlign: 'left' }}
                  onClick={async () => {
                    setPlan(p.key);
                    await fetch('/api/avatar/a1/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ anonymousId, sessionId, stepKey: 'plan', planKey: p.key, message: '我选择方案：' + p.label }),
                    });
                    // 选完方案 → 进入创作迭代
                    setStepIdx(5);
                    setBubbles((b) => [...b, { role: 'ai', content: A1_STEPS[5].aiAsk }]);
                  }}
                >
                  <b>{p.label}</b> — {p.note}
                </button>
              ))}
            </div>
          )}

          {/* 三版草稿（步5生成） */}
          {step.key === 'iterate' && !drafts && !submitted && (
            <div style={{ marginTop: 14 }}>
              <p className="note" style={{ margin: '0 0 6px' }}>AI 会先给你三版草稿，你来选最像你的一版。</p>
              <button className="primary" disabled={busy} onClick={generateDrafts}>
                {busy ? '生成中…' : '✦ 生成三版草稿'}
              </button>
            </div>
          )}

          {/* 草稿选择 + 评审 */}
          {drafts && !submitted && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', marginBottom: 8 }}>三版草稿 · 选一版最像你的</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {drafts.map((d) => (
                  <div key={d.id} style={{ padding: 12, borderRadius: 10, border: picked === d.id ? '2px solid var(--purple)' : '1px solid var(--border)', background: 'var(--panel)', cursor: 'pointer' }} onClick={() => setPicked(d.id)}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{d.id.toUpperCase()}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.text}</div>
                  </div>
                ))}
              </div>
              <button className="secondary" style={{ marginTop: 10 }} disabled={busy || !picked} onClick={judgePicked}>
                {busy ? '评审中…' : '让 AI 评审这一版'}
              </button>
              {feedback && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.4)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fde047', marginBottom: 4 }}>AI 评估</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{feedback}</div>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>想再改，直接在上面对话框单独说，改完再评审。</div>
              <button className="primary" style={{ width: '100%' }} disabled={busy || !finalText} onClick={submitFinal}>
                完成 · 提交我的作品
              </button>
            </div>
          )}

          {submitted && (
            <div className="bubble final">
              <span className="who">✅</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>作品已提交</div>
                <pre>{finalText}</pre>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>你的朋友圈作品已同步到大屏。</div>
              </div>
            </div>
          )}
        </div>

        {!submitted && (
          <div className="row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={step.key === 'build' ? '回答教练的问题，越具体，数字的你越像你…' : '继续告诉 AI…'}
              value={input}
              disabled={locked || busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            />
            <button className="secondary" disabled={busy || locked || !input.trim()} onClick={send}>
              {busy ? '思考中…' : '发送'}
            </button>
          </div>
        )}
      </div>

      {/* 步进按钮 */}
      {!submitted && !drafts && !['build', 'plan', 'iterate'].includes(step.key) && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="primary" disabled={busy || locked} onClick={goNextStep} style={{ padding: '10px 26px', borderRadius: 8 }}>
            进入下一步（{A1_STEPS[stepIdx + 1]?.name ?? ''}）→
          </button>
        </div>
      )}
    </div>
  );
}
