'use client';
// =========================================================
// A1 数字分身 · 学生端（十七环节：任务链 1-12 + 升华链 13-17）
// 小屏四区：当前任务 / 与 AI 对话 / 我的分身 / 提交（每环节一个主要动作）
// 环节由教师控制推进（subState avatar:c1..c17）
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { A1_STAGES } from '@/features/avatarLesson/config';
import { usePageOverrides } from '@/lib/usePageText';

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

  // c1 选择题
  const [problem, setProblem] = useState<string>('');
  const [notMe, setNotMe] = useState('');
  // c3 任务四框
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [t3, setT3] = useState('');
  const [t4, setT4] = useState('');
  // c5 样本
  const [sampleLike, setSampleLike] = useState('');
  const [sampleWhy, setSampleWhy] = useState('');
  const [sampleNever, setSampleNever] = useState('');
  const [sampleNeverWhy, setSampleNeverWhy] = useState('');
  // c9 判断
  const [judge, setJudge] = useState('');
  const [judgeNote, setJudgeNote] = useState('');
  // c11 验收
  const [accept, setAccept] = useState('');

  // 当前环节（avatar:cN → 0..16）
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^avatar:(c\d+)$/);
    return m ? A1_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const inHook = String(subState ?? '') === 'avatar:hook' || stageIdx < 0;
  const isWall = String(subState ?? '') === 'avatar:wall';
  const stage = stageIdx >= 0 ? A1_STAGES[stageIdx] : null;

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
          setBubbles([{ role: 'ai', content: '你好！今天我们一起来创造一个了解你的 AI 分身。\n\n先问一句：你以前让 AI 写过朋友圈、消息或文案吗？有没有"写得好，但不是我会说的话"的时候？' }]);
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
      // c4 采访完成 → 自动生成分身档案
      if (stage.key === 'c4' && d.done) {
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

  // c6 生成第一版档案
  async function makeArchive() {
    if (busy || !stage) return;
    setBusy(true);
    setSkillLoading(true);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c6', message: '请根据刚才的访谈，整理我的 AI 分身档案（我是谁/我关注什么/我怎么表达/我不怎么表达/写朋友圈规则/待确认）。不要夸大。' }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
      // 同时生成结构化 skill
      const sres = await fetch('/api/avatar/a1/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId }),
      });
      const sd = await sres.json();
      if (sd.skill) setSkill({ skill: sd.skill, profile: sd.profile });
    } finally {
      setSkillLoading(false);
      setBusy(false);
    }
  }

  // c8 生成三版朋友圈
  async function genDrafts() {
    if (busy || !stage) return;
    setBusy(true);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c8', message: `请用我的分身档案，为这件事写三条朋友圈（三版风格不同但都像我）：${task}` }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
  }

  // c11 提交验收
  async function submitFinal() {
    const text = (accept || input).trim();
    if (!text || busy || !stage) return;
    setBusy(true);
    try {
      const res = await fetch('/api/avatar/a1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'c11', message: `我的验收：最像我的一句是「${text}」。请把确认的规则加入分身档案。` }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'user', content: `最像我的一句：${text}` }, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="ai-workspace">
      {/* 当前任务卡 */}
      <div className="zone" style={{ borderLeft: '4px solid #c4b5fd' }}>
        <h3 style={{ color: '#c4b5fd', margin: 0 }}>环节 {stageIdx + 1} · {stage?.name}</h3>
        <p className="task-hint" style={{ color: '#fde047', fontWeight: 600, lineHeight: 1.6, margin: '8px 0 4px' }}>{ov.screenTitle ?? stage?.screenTitle}</p>
        <p className="task-hint" style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{ov.studentTask ?? stage?.studentTask}</p>
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

          {/* c6/c7/c12：分身档案卡 */}
          {skill && stageIdx >= 5 && (
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

        {/* c1：选择题 */}
        {stage?.key === 'c1' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>AI 写的内容最常见的问题是什么？</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['太正式', '太夸张', '太像广告', '太有 AI 味', '观点不是我的', '用词不是我的'].map((p) => (
                <button key={p} className={problem === p ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setProblem(p)}>{p}</button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>写一句"AI 经常写、但你自己绝不会说"的话：</div>
              <input placeholder="例：治愈了我的灵魂。" value={notMe} onChange={(e) => setNotMe(e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>
        )}

        {/* c3：任务四框 */}
        {stage?.key === 'c3' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            <input placeholder="发生了什么？" value={t1} onChange={(e) => setT1(e.target.value)} style={{ fontSize: 13 }} />
            <input placeholder="哪个细节最值得记录？" value={t2} onChange={(e) => setT2(e.target.value)} style={{ fontSize: 13 }} />
            <input placeholder="真正想表达什么？" value={t3} onChange={(e) => setT3(e.target.value)} style={{ fontSize: 13 }} />
            <input placeholder="希望别人看完什么感觉？" value={t4} onChange={(e) => setT4(e.target.value)} style={{ fontSize: 13 }} />
            <button className="primary" disabled={!t1 || busy} onClick={async () => {
              const tt = `发生了${t1}；细节：${t2}；想表达：${t3}；希望感受：${t4}`;
              setTask(tt);
              const r = await fetch('/api/avatar/a1/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonymousId, sessionId, stage: 'c3', message: tt }) });
              const d = await r.json();
              if (d.reply) setBubbles((b) => [...b, { role: 'user', content: tt }, { role: 'ai', content: d.reply }]);
            }}>确认我的朋友圈任务</button>
          </div>
        )}

        {/* c5：样本 */}
        {stage?.key === 'c5' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            <textarea placeholder="粘贴一段你以前写过、很像自己的文字" value={sampleLike} onChange={(e) => setSampleLike(e.target.value)} style={{ fontSize: 13, minHeight: 60 }} />
            <input placeholder="这段为什么像我？" value={sampleWhy} onChange={(e) => setSampleWhy(e.target.value)} style={{ fontSize: 13 }} />
            <input placeholder="写一句你绝对不会说的话" value={sampleNever} onChange={(e) => setSampleNever(e.target.value)} style={{ fontSize: 13 }} />
            <input placeholder="为什么不会这样说？" value={sampleNeverWhy} onChange={(e) => setSampleNeverWhy(e.target.value)} style={{ fontSize: 13 }} />
            <button className="primary" disabled={!sampleLike || busy} onClick={async () => {
              const tt = `像我：${sampleLike}（因为${sampleWhy}）；不会说：${sampleNever}（因为${sampleNeverWhy}）`;
              const r = await fetch('/api/avatar/a1/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonymousId, sessionId, stage: 'c5', message: tt }) });
              const d = await r.json();
              if (d.reply) setBubbles((b) => [...b, { role: 'user', content: tt }, { role: 'ai', content: d.reply }]);
            }}>提交我的样本</button>
          </div>
        )}

        {/* c6：生成档案 */}
        {stage?.key === 'c6' && (
          <button className="primary" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={makeArchive}>
            {busy ? '整理中…' : '✦ 让 AI 整理我的分身档案'}
          </button>
        )}

        {/* c8：生成三版 */}
        {stage?.key === 'c8' && task && (
          <button className="primary" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={genDrafts}>
            {busy ? '生成中…' : '✦ 让分身写三版朋友圈'}
          </button>
        )}

        {/* c9：判断 */}
        {stage?.key === 'c9' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>三版里，最像你的是？</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['很像我', '有一点像', '不太像', '完全不像'].map((j) => (
                <button key={j} className={judge === j ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setJudge(j)}>{j}</button>
              ))}
            </div>
            <input placeholder="最不像我的一句/一个词是…" value={judgeNote} onChange={(e) => setJudgeNote(e.target.value)} style={{ fontSize: 13, marginTop: 8 }} />
            <button className="secondary" style={{ width: '100%', marginTop: 8 }} disabled={!judgeNote || busy} onClick={async () => {
              const r = await fetch('/api/avatar/a1/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonymousId, sessionId, stage: 'c9', message: `我的判断：${judge}。不像我的：${judgeNote}` }) });
              const d = await r.json();
              if (d.reply) setBubbles((b) => [...b, { role: 'user', content: `判断：${judge}；不像：${judgeNote}` }, { role: 'ai', content: d.reply }]);
            }}>把判断告诉 AI</button>
          </div>
        )}

        {/* c11：验收 */}
        {stage?.key === 'c11' && (
          <div style={{ marginTop: 10 }}>
            <input placeholder="最像我的一句是…" value={accept} onChange={(e) => setAccept(e.target.value)} style={{ fontSize: 13 }} />
            <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={!accept || busy} onClick={submitFinal}>验收 · 提交我的一句话</button>
          </div>
        )}

        {/* c12：保存分身 */}
        {stage?.key === 'c12' && skill && (
          <button className="primary" style={{ width: '100%', marginTop: 10 }} disabled={submitted || busy} onClick={async () => {
            const r = await fetch('/api/avatar/a1/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonymousId, sessionId, stage: 'c12', message: '请整理最终分身档案并保存，我会继续使用。' }) });
            const d = await r.json();
            if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
            setSubmitted(true);
          }}>
            {submitted ? '✅ 分身已保存' : '💾 保存我的分身'}
          </button>
        )}
      </div>

      {/* 对话输入（升华链 c13-c17 主要看大屏，给个简单输入） */}
      {(stageIdx < 12) && !submitted && (
        <div className="row" style={{ marginTop: 10 }}>
          <textarea
            placeholder={stage?.key === 'c4' ? '回答 AI 的采访，越真实越好…' : '跟 AI 说…'}
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
