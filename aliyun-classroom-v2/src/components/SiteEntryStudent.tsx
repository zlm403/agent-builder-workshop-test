'use client';
// =========================================================
// P2 快速入门网站 · 学生端组件（六步连续对话）
// 手机端：一个连续对话框，不停地问、不停地说；最后生成网站、小白测试、发布。
// 大屏端：六格点亮由教师控制，与手机端解耦。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { P2_STEPS } from '@/features/siteEntry/config';

interface Bubble {
  role: 'ai' | 'user';
  content: string;
}

export default function SiteEntryStudent({
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
  const [siteCode, setSiteCode] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [finalWork, setFinalWork] = useState('');
  const [showSite, setShowSite] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const step = P2_STEPS[stepIdx];

  // 加载已保存状态
  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/site-entry/state?sessionId=${sessionId}&anonymousId=${anonymousId}`);
        const d = await res.json();
        if (d.chatLog && Array.isArray(d.chatLog)) {
          setBubbles(d.chatLog.filter((m: any) => m.role === 'ai' || m.role === 'user'));
        }
        if (d.siteCode) setSiteCode(d.siteCode);
        if (d.testNote) setTestNote(d.testNote);
        if (d.finalWork) setFinalWork(d.finalWork);
        if (d.submittedAt) setSubmitted(true);
        const s = Math.min(6, Math.max(1, Number(d.step) || 1));
        if (d.finalWork || d.submittedAt) setStepIdx(5);
        else if (d.siteCode) setStepIdx(5);
        else setStepIdx(s - 1);
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: P2_STEPS[0].aiAsk }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, siteCode, testNote]);

  async function send() {
    const text = input.trim();
    if (!text || busy || locked) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/site-entry/chat', {
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
      if (step.key === 'skeleton' && d.done) {
        // 知识骨架完成：自动推进到「形成判断标准」(3→4)
        setStepIdx(3);
        setBubbles((b) => [...b, { role: 'ai', content: P2_STEPS[3].aiAsk }]);
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
      const res = await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stepKey: oldStep, message: '我准备好了，进入下一步。' }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
      else setBubbles((b) => [...b, { role: 'ai', content: P2_STEPS[ni].aiAsk }]);
    } catch {
      setBubbles((b) => [...b, { role: 'ai', content: P2_STEPS[ni].aiAsk }]);
    } finally {
      setBusy(false);
    }
  }

  async function generateSite() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/site-entry/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'generate' }),
      });
      const d = await res.json();
      if (d.code) {
        setSiteCode(d.code);
        setBubbles((b) => [...b, { role: 'ai', content: '网站第一版已经生成。点「查看网站」做一次小白测试：让一个不懂的人走一遍，能不能看懂门道、作出选择？' }]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function judgeWork() {
    if (busy || !finalWork) return;
    setBusy(true);
    try {
      const res = await fetch('/api/site-entry/generate', {
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
      const res = await fetch('/api/site-entry/submit', {
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
    return <p className="note">正在加载你的入门网站…</p>;
  }

  return (
    <div className="ai-workspace">
      <div className="zone">
        <h3 style={{ color: '#38bdf8' }}>
          P2 快速入门网站 · {step.name}
          <span style={{ float: 'right', fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
            {stepIdx + 1} / {P2_STEPS.length}
          </span>
        </h3>
        <p className="task-hint" style={{ color: '#bae6fd', lineHeight: 1.6, margin: '6px 0 0' }}>{step.title}</p>
      </div>

      <div className="zone ai-zone">
        <h3>{stepIdx === 5 ? '和 AI 一起打磨你的入门网站' : '和领域入门教练对话'}</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}

          {/* 网站生成 + 查看（步6） */}
          {step.key === 'iterate' && siteCode && !submitted && (
            <div style={{ marginTop: 14 }}>
              <p className="note" style={{ margin: '0 0 6px' }}>AI 已为你生成手机网站第一版。</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="primary" onClick={() => setShowSite(true)}>🖥 查看网站（小白测试）</button>
              </div>
              <p className="note" style={{ margin: '10px 0 4px' }}>把测试结果记下来：这网站能不能让不懂的人看懂门道、作出选择？</p>
              <textarea
                placeholder="小白测试结果…（例：三个区别他看了两遍才明白，建议改成对比卡片）"
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
                    完成 · 发布我的入门网站
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>网站已发布</div>
                <pre>{finalWork}</pre>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>你的入门网站已同步到大屏。</div>
              </div>
            </div>
          )}
        </div>

        {!submitted && (
          <div className="row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={step.key === 'skeleton' ? '向教练抛出你真正想知道的问题…' : '继续告诉 AI…'}
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
      {step.key === 'iterate' && !siteCode && !submitted && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="primary" disabled={busy || locked} onClick={generateSite} style={{ padding: '10px 26px', borderRadius: 8 }}>
            {busy ? '生成中…' : '✦ 生成网站第一版'}
          </button>
        </div>
      )}
      {!submitted && !['skeleton', 'iterate'].includes(step.key) && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="primary" disabled={busy || locked} onClick={goNextStep} style={{ padding: '10px 26px', borderRadius: 8 }}>
            进入下一步（{P2_STEPS[stepIdx + 1]?.name ?? ''}）→
          </button>
        </div>
      )}

      {/* 网站预览弹层（小白测试） */}
      {showSite && siteCode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', zIndex: 999 }}
          onClick={() => setShowSite(false)}
        >
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}>
            <button className="primary" onClick={() => setShowSite(false)} style={{ padding: '8px 18px', borderRadius: 8 }}>
              关闭预览
            </button>
          </div>
          <iframe
            srcDoc={siteCode}
            title="入门网站预览"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}