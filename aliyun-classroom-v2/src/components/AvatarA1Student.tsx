'use client';
// =========================================================
// A1 数字分身 · 学生端（解耦环节版）
// 学生端只保留聊天框：与 AI 自由聊如何形成分身 Skill、如何写朋友圈文案。
// 环节推进由教师端控制（locked：锁→看→解锁→操作→上墙→再锁）；AI 对话不再绑定 subState/stage。
// 生成分身：AI 采访得差不多后主动提议（回复带【生成分身】标记）→ 聊天框上方临时出现按钮 → 学生点击生成。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/basePath';

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
  subState?: string | null;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [skill, setSkill] = useState<{ skill: string; profile: SkillCard } | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [lastDraft, setLastDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offerGenerate, setOfferGenerate] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // 加载已保存状态
  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(api(`/api/avatar/a1/state?sessionId=${sessionId}&anonymousId=${anonymousId}`));
        const d = await res.json();
        if (d.chatLog && Array.isArray(d.chatLog)) {
          setBubbles(d.chatLog.filter((m: any) => m.role === 'ai' || m.role === 'user'));
        }
        if (d.skill) setSkill({ skill: d.skill, profile: d.profile });
        if (d.task) setLastDraft(String(d.task));
        if (d.submittedAt) setSubmitted(true);
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: '你好！今天我们要一起创造一个了解你的 AI 分身。\n\n你可以随时和我聊——说说你想让它帮你做什么，我会一个问题一个问题地了解你，聊得差不多了就帮你生成一份属于你的「数字分身」.' }]);
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
    if (!text || busy || locked) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch(api('/api/avatar/a1/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'free', message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      const raw = d.reply || '';
      const offer = !!d.offerGenerate;
      const clean = raw.replace(/^【生成分身】/, '').trim();
      if (clean) {
        setBubbles((b) => [...b, { role: 'ai', content: clean }]);
        if (offer && !skill) setOfferGenerate(true);
      }
    } finally {
      setBusy(false);
    }
  }

  // AI 提议后，学生点按钮生成分身 Skill（调既有接口）
  async function genSkill() {
    if (busy) return;
    setBusy(true);
    setSkillLoading(true);
    try {
      const sres = await fetch(api('/api/avatar/a1/skill'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId }),
      });
      const sd = await sres.json();
      if (sd.skill) {
        setSkill({ skill: sd.skill, profile: sd.profile });
        setOfferGenerate(false);
      }
    } finally {
      setBusy(false);
      setSkillLoading(false);
    }
  }

  // 让分身写一条朋友圈
  async function askDraft() {
    if (busy) return;
    setBusy(true);
    try {
      const msg = '现在用我的分身 Skill，为最近一件真实的事写一条朋友圈。写完我来看看像不像我。';
      setBubbles((b) => [...b, { role: 'user', content: msg }]);
      const res = await fetch(api('/api/avatar/a1/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'free', message: msg }),
      });
      const d = await res.json();
      if (d.reply) { setBubbles((b) => [...b, { role: 'ai', content: d.reply }]); setLastDraft(d.reply); }
    } finally {
      setBusy(false);
    }
  }

  // 不满意 → 让分身改
  async function askFix() {
    if (busy) return;
    setBusy(true);
    try {
      const msg = '这一版还不太像我说的话，请你根据我的分身档案再改一版，改得更像我。';
      setBubbles((b) => [...b, { role: 'user', content: msg }]);
      const res = await fetch(api('/api/avatar/a1/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 'free', message: msg }),
      });
      const d = await res.json();
      if (d.reply) { setBubbles((b) => [...b, { role: 'ai', content: d.reply }]); setLastDraft(d.reply); }
    } finally {
      setBusy(false);
    }
  }

  // 提交作品上墙
  async function submitFinal() {
    const lastAi = [...bubbles].reverse().find((b) => b.role === 'ai');
    const text = (lastDraft || lastAi?.content || '').trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch(api('/api/avatar/a1/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, finalText: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || '提交失败，请重试'}` }]);
        return;
      }
      setSubmitted(true);
      setBubbles((b) => [...b, { role: 'ai', content: submitted ? '🔄 已重新提交，作品墙已更新。' : '🎉 已提交！你的朋友圈马上飞上大屏。' }]);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="note">正在加载你的分身…</p>;
  }

  return (
    <div className="ai-workspace">
      <div className="zone ai-zone">
        <h3>和 AI 聊</h3>
        {skill && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.45)' }}>
            <button className="primary" style={{ fontSize: 13 }} disabled={busy} onClick={askDraft}>🧠 我的分身</button>
            <span style={{ fontSize: 11, color: '#c4b5fd' }}>点它，用你的分身写一条朋友圈</span>
          </div>
        )}
        {offerGenerate && !skill && (
          <button className="primary" style={{ marginTop: 6, marginBottom: 8 }} disabled={busy || skillLoading} onClick={genSkill}>
            {skillLoading ? '正在生成…' : '✨ 生成我的数字分身'}
          </button>
        )}
        <div className="chat-log" ref={logRef} style={{ maxHeight: 240, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}
          {skillLoading && <div style={{ textAlign: 'center', color: '#c4b5fd', padding: 8 }}>正在整理你的分身…</div>}
        </div>

        {skill && lastDraft && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="secondary" style={{ flex: 1 }} disabled={busy} onClick={askFix}>让它更像我</button>
            <button className="primary" style={{ flex: 1 }} disabled={busy || !lastDraft} onClick={submitFinal}>
              {submitted ? '🔄 再次提交（覆盖）' : '🚀 提交上墙'}
            </button>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <textarea
          placeholder={locked ? '老师还没放开操作，先看看大屏～' : '跟 AI 说…'}
          value={input}
          disabled={locked || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
        />
        <button className="secondary" disabled={busy || locked || !input.trim()} onClick={send}>
          {busy ? '思考中…' : '发送'}
        </button>
      </div>
    </div>
  );
}
