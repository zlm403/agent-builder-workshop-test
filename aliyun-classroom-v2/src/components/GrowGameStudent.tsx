'use client';
// =========================================================
// P3 养成游戏 · 学生端组件（六步连续对话）
// 手机端：一个连续对话框，不停地问、不停地说；最后生成游戏、试玩修改、发布。
// 大屏端：六格点亮由教师控制，与手机端解耦。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { P3_STEPS } from '@/features/growGame/config';

interface Bubble {
  role: 'ai' | 'user';
  content: string;
}

export default function GrowGameStudent({
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
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [finalWork, setFinalWork] = useState('');
  const [showGame, setShowGame] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const step = P3_STEPS[stepIdx];

  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/grow-game/state?sessionId=${sessionId}&anonymousId=${anonymousId}`);
        const d = await res.json();
        if (d.chatLog && Array.isArray(d.chatLog)) {
          setBubbles(d.chatLog.filter((m: any) => m.role === 'ai' || m.role === 'user'));
        }
        if (d.gameCode) setGameCode(d.gameCode);
        if (d.testNote) setTestNote(d.testNote);
        if (d.finalWork) setFinalWork(d.finalWork);
        if (d.submittedAt) setSubmitted(true);
        const s = Math.min(6, Math.max(1, Number(d.step) || 1));
        if (d.finalWork || d.submittedAt) setStepIdx(5);
        else if (d.gameCode) setStepIdx(5);
        else setStepIdx(s - 1);
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: P3_STEPS[0].aiAsk }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, gameCode, testNote]);

  async function send() {
    const text = input.trim();
    if (!text || busy || locked) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/grow-game/chat', {
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
      if (step.key === 'rules' && d.done) {
        // 核心规则建立完成：自动推进到「设计事件」(3→4)
        setStepIdx(3);
        setBubbles((b) => [...b, { role: 'ai', content: P3_STEPS[3].aiAsk }]);
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
      const res = await fetch('/api/grow-game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stepKey: oldStep, message: '我准备好了，进入下一步。' }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
      else setBubbles((b) => [...b, { role: 'ai', content: P3_STEPS[ni].aiAsk }]);
    } catch {
      setBubbles((b) => [...b, { role: 'ai', content: P3_STEPS[ni].aiAsk }]);
    } finally {
      setBusy(false);
    }
  }

  async function generateGame() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/grow-game/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'generate' }),
      });
      const d = await res.json();
      if (d.code) {
        setGameCode(d.code);
        setBubbles((b) => [...b, { role: 'ai', content: '游戏第一版已经生成。点「试玩游戏」把一局打完：选择是否有效？冲突是否好玩？结局是否合理？' }]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function judgeWork() {
    if (busy || !finalWork) return;
    setBusy(true);
    try {
      const res = await fetch('/api/grow-game/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'judge', finalWork, testNote }),
      });
      const d = await res.json();
      setTestNote(d.note || '');
      setBubbles((b) => [...b, { role: 'user', content: finalWork }, { role: 'ai', content: d.note || '' }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitFinal() {
    if (busy || !finalWork) return;
    setBusy(true);
    try {
      const res = await fetch('/api/grow-game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, finalWork }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="note">正在加载你的养成游戏…</p>;
  }

  return (
    <div className="ai-workspace">
      <div className="zone">
        <h3 style={{ color: '#38bdf8' }}>
          P3 养成游戏 · {step.name}
          <span style={{ float: 'right', fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
            {stepIdx + 1} / {P3_STEPS.length}
          </span>
        </h3>
        <p className="task-hint" style={{ color: '#bae6fd', lineHeight: 1.6, margin: '6px 0 0' }}>{step.title}</p>
      </div>

      <div className="zone ai-zone">
        <h3>{stepIdx === 5 ? '和 AI 一起打磨你的养成游戏' : '和游戏设计教练对话'}</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}

          {/* 游戏生成 + 试玩（步6） */}
          {step.key === 'iterate' && gameCode && !submitted && (
            <div style={{ marginTop: 14 }}>
              <p className="note" style={{ margin: '0 0 6px' }}>AI 已为你生成手游第一版。</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="primary" onClick={() => setShowGame(true)}>🕹 试玩游戏（打一局）</button>
              </div>
              <p className="note" style={{ margin: '10px 0 4px' }}>把试玩结果记下来：选择是否有效？冲突是否好玩？结局是否合理？</p>
              <textarea
                placeholder="试玩结果…（例：两个选项没有真正的取舍，建议让每个选项都同时加一项减一项）"
                value={finalWork}
                disabled={locked || busy}
                onChange={(e) => setFinalWork(e.target.value)}
                style={{ minHeight: 80 }}
              />
              {finalWork && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="secondary" disabled={busy} onClick={judgeWork}>
                    {busy ? '评审中…' : '让 AI 评审可发布性'}
                  </button>
                  <button className="primary" disabled={busy || !testNote} onClick={submitFinal}>
                    完成 · 发布我的养成游戏
                  </button>
                </div>
              )}
              {testNote && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.4)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fde047', marginBottom: 4 }}>AI 评估</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{testNote}</div>
                </div>
              )}
            </div>
          )}

          {submitted && (
            <div className="bubble final">
              <span className="who">✅</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>游戏已发布</div>
                <pre>{finalWork}</pre>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>你的养成游戏已同步到大屏。</div>
              </div>
            </div>
          )}
        </div>

        {!submitted && (
          <div className="row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={step.key === 'rules' ? '告诉教练你的核心属性和冲突…' : '继续告诉 AI…'}
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
      {step.key === 'iterate' && !gameCode && !submitted && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="primary" disabled={busy || locked} onClick={generateGame} style={{ padding: '10px 26px', borderRadius: 8 }}>
            {busy ? '生成中…' : '✦ 生成游戏第一版'}
          </button>
        </div>
      )}
      {!submitted && !['rules', 'iterate'].includes(step.key) && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="primary" disabled={busy || locked} onClick={goNextStep} style={{ padding: '10px 26px', borderRadius: 8 }}>
            进入下一步（{P3_STEPS[stepIdx + 1]?.name ?? ''}）→
          </button>
        </div>
      )}

      {/* 游戏预览弹层（试玩） */}
      {showGame && gameCode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', zIndex: 999 }}
          onClick={() => setShowGame(false)}
        >
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}>
            <button className="primary" onClick={() => setShowGame(false)} style={{ padding: '8px 18px', borderRadius: 8 }}>
              关闭预览
            </button>
          </div>
          <iframe
            srcDoc={gameCode}
            title="养成游戏试玩"
            style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}