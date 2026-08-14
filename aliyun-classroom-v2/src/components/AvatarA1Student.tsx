'use client';
// =========================================================
// A1 数字分身 · 学生端（2026-08-14 新结构 13 屏）
// c1 发布任务 → c2 沟通准则① → c3 目标辨析 → c4 沟通准则② → c5 AI采访我
// → c6 让分身开始工作（完整工作区）→ 作品墙 → c7/c8 梦想(看图) → c9/c10 现实(看视频) → c11 收束
// 环节由教师控制推进（subState avatar:cN）
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { A1_STAGES } from '@/features/avatarLesson/config';
import { usePageOverrides, pageText } from '@/lib/usePageText';

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
  subState,
}: {
  anonymousId: string;
  sessionId: string;
  locked: boolean;
  subState?: string | null;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ov = usePageOverrides(subState);
  const [skill, setSkill] = useState<{ skill: string; profile: SkillCard } | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [task, setTask] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // 当前环节（avatar:cN → index）
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^avatar:(c\d+)$/);
    return m ? A1_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const inHook = String(subState ?? '') === 'avatar:hook' || stageIdx < 0;
  const isWall = String(subState ?? '') === 'avatar:wall';
  const stage = stageIdx >= 0 ? A1_STAGES[stageIdx] : null;
  const isC6 = stage?.key === 'c6';
  const isWatchOnly = !!stage && ['c7', 'c8', 'c9', 'c10', 'c11'].includes(stage.key);

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
        if (d.task) { const tt = String(d.task); setTask(tt); }
        if (d.submittedAt) setSubmitted(true);
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: '你好！今天我们要一起创造一个了解你的 AI 分身。\n\n我们先说清楚：我们到底要做什么？你可以先想一下——然后我们再和 AI 确认这个目标。' }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, skill]);

  async function send() {
    const text = input.trim();
    if (!text || busy || locked || !stage) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: stage.key, message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      const clean = (d.reply || '').replace(/^【进入下一步】/, '').trim();
      if (clean) setBubbles((b) => [...b, { role: 'ai', content: clean }]);
      // c5 AI采访完成 → 自动生成 Skill
      if (stage.key === 'c5' && d.done) {
        setSkillLoading(true);
        const sres = await fetch('/api/avatar/a1/skill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymousId, sessionId }),
        });
        const sd = await sres.json();
        setSkillLoading(false);
        if (sd.skill) setSkill({ skill: sd.skill, profile: sd.profile });
      }
    } finally {
      setBusy(false);
    }
  }

  // c6 让分身写朋友圈
  async function askDraft() {
    if (busy || !stage) return;
    setBusy(true);
    try {
      const msg = '现在用我的分身 Skill，为最近一件真实的事写一条朋友圈。写完我来看看像不像我。';
      setBubbles((b) => [...b, { role: 'user', content: msg }]);
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c6', message: msg }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
  }

  // c6 不满意 → 让分身改
  async function askFix() {
    if (busy || !stage) return;
    setBusy(true);
    try {
      const msg = '这一版还不太像我说的话，请你根据我的分身档案再改一版，改得更像我。';
      setBubbles((b) => [...b, { role: 'user', content: msg }]);
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c6', message: msg }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
  }

  // c6 提交作品
  async function submitFinal() {
    const text = input.trim();
    if (!text || busy || !stage) return;
    setBusy(true);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c6', message: `我的最终朋友圈：${text}。请提交。` }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'user', content: text }, { role: 'ai', content: d.reply }]);
      setSubmitted(true);
      onSubmitted?.();
    } finally {
      setBusy(false);
    }
  }

  function onSubmitted() {
    // 通知父级刷新状态（由页面注入，可选）
    if (typeof (window as any).__a1SubmitHook === 'function') (window as any).__a1SubmitHook();
  }

  if (loading) {
    return <p className="note">正在加载你的分身…</p>;
  }

  // 钩子/未进入：看大屏
  if (inHook && !isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">今天我们要一起创造一个了解你的 AI 分身。听老师讲开场。</p>
      </div>
    );
  }

  if (isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">全班的数字分身和朋友圈已经上墙，看看大家的作品吧。</p>
      </div>
    );
  }

  // 看图/看视频/收束：学生端看大屏
  if (isWatchOnly) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">跟着老师看大屏，想一想。{stage?.studentTask || ''}</p>
      </div>
    );
  }

  return (
    <div className="ai-workspace">
      {/* 当前任务卡 */}
      <div className="zone" style={{ borderLeft: '4px solid #c4b5fd' }}>
        <h3 style={{ color: '#c4b5fd', margin: 0 }}>环节 {stageIdx + 1} · {stage?.name}</h3>
        {pageText(ov, 'screenTitle', stage?.screenTitle ?? '') !== null && <p className="task-hint" style={{ color: '#fde047', fontWeight: 600, lineHeight: 1.6, margin: '8px 0 4px', whiteSpace: 'pre-wrap' }}>{pageText(ov, 'screenTitle', stage?.screenTitle ?? '')}</p>}
        {pageText(ov, 'studentTask', stage?.studentTask ?? '') !== null && <p className="task-hint" style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{pageText(ov, 'studentTask', stage?.studentTask ?? '')}</p>}
      </div>

      <div className="zone ai-zone">
        <h3>和 AI 聊</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 240, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}
          {skillLoading && <div style={{ textAlign: 'center', color: '#c4b5fd', padding: 8 }}>正在整理你的分身…</div>}

          {/* 分身档案卡（c6 工作区） */}
          {skill && isC6 && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.45)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 8 }}>🧠 你的分身档案</div>
              {skill.profile?.labels?.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {skill.profile.labels.map((l, i2) => (
                    <span key={i2} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>{l}</span>
                  ))}
                </div>
              ) : null}
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>{skill.skill}</pre>
            </div>
          )}
        </div>

        {/* c6 完整工作区：让分身写朋友圈 + 修改 + 提交 */}
        {isC6 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary" style={{ flex: 1 }} disabled={busy} onClick={askDraft}>
                {busy ? '写朋友圈中…' : '✦ 让分身写一条朋友圈'}
              </button>
              <button className="secondary" style={{ flex: 1 }} disabled={busy} onClick={askFix}>
                让它更像我
              </button>
            </div>
            <textarea
              placeholder="满意的话，把最终朋友圈粘到这里提交…"
              value={input}
              disabled={locked || busy}
              onChange={(e) => setInput(e.target.value)}
              style={{ fontSize: 13, minHeight: 60 }}
            />
            <button className="primary" disabled={submitted || busy || !input.trim()} onClick={submitFinal}>
              {submitted ? '✅ 已提交' : '🚀 提交我的朋友圈'}
            </button>
          </div>
        )}
      </div>

      {/* 对话输入（c1~c5 用） */}
      {!isC6 && !submitted && (
        <div className="row" style={{ marginTop: 10 }}>
          <textarea
            placeholder={stage?.key === 'c5' ? '回答 AI 的采访，越真实越好…' : '跟 AI 说…'}
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
  );
}
