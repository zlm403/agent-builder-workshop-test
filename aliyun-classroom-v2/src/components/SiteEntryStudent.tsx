'use client';
// =========================================================
// A2 快速入门网站 · 学生端
// 核心体验：和 AI 团队聊天 → 确定员工 → 卡片"嘣"跳出（对话框外）
//          → 轮到谁发言谁点亮 → 说"那你干吧"触发建立 → 团队开会自动执行做网站
//          → 检验迭代 → 提交上墙
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { A2_STAGES } from '@/features/siteEntry/config';
import { usePageOverrides, pageText } from '@/lib/usePageText';

interface Bubble {
  role: 'user' | 'assistant';
  content: string;
  speaker?: string;
}

interface TeamMember {
  id: string;
  label: string;
  icon: string;
  duty: string;
}

export default function SiteEntryStudent({
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
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [building, setBuilding] = useState<string | null>(null); // 正在建立的员工 label
  const [litSpeaker, setLitSpeaker] = useState<string | null>(null); // 当前点亮的角色
  const [siteCode, setSiteCode] = useState<string | null>(null);
  const [showSite, setShowSite] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const ov = usePageOverrides(subState);
  const logRef = useRef<HTMLDivElement>(null);

  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^a2:(s\d+)$/);
    return m ? A2_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const inHook = String(subState ?? '') === 'a2:hook' || stageIdx < 0;
  const isWall = String(subState ?? '') === 'a2:wall';
  const stage = stageIdx >= 0 ? A2_STAGES[stageIdx] : null;
  const isWatchOnly = !!stage && ['s1', 's2', 's3', 's7', 's8', 's10', 's11'].includes(stage.key);

  // 加载状态
  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const r = await fetch(`/api/site-entry/state?sessionId=${sessionId}&anonymousId=${anonymousId}`);
        const d = await r.json();
        if (Array.isArray(d.team)) setTeam(d.team);
        if (Array.isArray(d.chatLog)) setBubbles(d.chatLog.filter((m: any) => m.role === 'user' || m.role === 'assistant'));
        if (d.siteCode) setSiteCode(d.siteCode);
        if (d.submittedAt) setSubmitted(true);
        if (!Array.isArray(d.chatLog) || d.chatLog.length === 0) {
          setBubbles([{ role: 'assistant', content: '你好！我是你今天的「AI 团队」召集人。\n\n我们要一起做一个「帮小白快速进入陌生领域」的手机网站。你先说说：你想帮别人进入哪个领域？（咖啡、摄影、健身……都可以）' }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles]);

  // 点亮效果：speaker 高亮 1.5 秒后熄灭
  useEffect(() => {
    if (!litSpeaker) return;
    const t = setTimeout(() => setLitSpeaker(null), 1600);
    return () => clearTimeout(t);
  }, [litSpeaker]);

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
        body: JSON.stringify({ anonymousId, sessionId, message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'assistant', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      // 清理【建立】信号（卡片展示，不出现在气泡里）
      const clean = (d.reply || '').replace(/【建立】\s*[^\n【】]*\n?/g, '').trim();
      if (clean) setBubbles((b) => [...b, { role: 'assistant', content: clean, speaker: d.speaker ?? undefined }]);

      // 建立员工：卡片"嘣"跳出
      if (d.built) {
        setBuilding(d.built);
        await new Promise((r) => setTimeout(r, 600)); // 制造"正在建立"节奏
        setBuilding(null);
        if (Array.isArray(d.team)) setTeam(d.team);
      } else if (Array.isArray(d.team)) {
        setTeam(d.team);
      }

      // 点亮发言者
      if (d.speaker) setLitSpeaker(d.speaker);

      // 若 AI 输出了网站 HTML，自动存为预览
      const html = (d.reply || '').match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
      if (html) setSiteCode(html[0]);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/site-entry/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId }),
      });
      setSubmitted(true);
      setBubbles((b) => [...b, { role: 'assistant', content: '🎉 作品已提交，马上上大屏！' }]);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="note">正在加载…</p>;

  if (inHook && !isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">今天我们要组建一支 AI 团队，做一个帮小白快速进入陌生领域的网站。听老师讲开场。</p>
      </div>
    );
  }

  if (isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">全班的网站已经上墙，看看大家的作品吧。</p>
      </div>
    );
  }

  if (isWatchOnly) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">{stage?.studentTask || ''}</p>
      </div>
    );
  }

  return (
    <div className="ai-workspace">
      {/* 当前任务卡 */}
      <div className="zone" style={{ borderLeft: '4px solid #38bdf8' }}>
        <h3 style={{ color: '#38bdf8', margin: 0 }}>环节 {stageIdx + 1} · {stage?.name}</h3>
        {pageText(ov, 'screenTitle', stage?.screenTitle ?? '') !== null && <p className="task-hint" style={{ color: '#fde047', fontWeight: 600, lineHeight: 1.6, margin: '8px 0 4px', whiteSpace: 'pre-line' }}>{pageText(ov, 'screenTitle', stage?.screenTitle ?? '')}</p>}
        {pageText(ov, 'studentTask', stage?.studentTask ?? '') !== null && <p className="task-hint" style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{pageText(ov, 'studentTask', stage?.studentTask ?? '')}</p>}
      </div>

      {/* 我的 AI 团队（卡片区，对话框外） */}
      <div className="zone" style={{ border: '1px solid rgba(56,189,248,.3)', background: 'rgba(56,189,248,.04)' }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 10px' }}>我的 AI 团队</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
          {team.map((t) => {
            const isLit = litSpeaker === t.label;
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                background: isLit ? 'rgba(56,189,248,.35)' : 'rgba(15,23,42,.6)',
                border: isLit ? '2px solid #38bdf8' : '1px solid var(--border)',
                boxShadow: isLit ? '0 0 12px rgba(56,189,248,.6)' : 'none',
                transition: 'all .2s',
                animation: isLit ? 'none' : undefined,
              }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</span>
              </div>
            );
          })}
          {building && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(250,204,21,.12)', border: '1px dashed rgba(250,204,21,.6)', fontSize: 13, color: '#fde047', fontWeight: 700 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>⚙️</span> {building} 正在建立…
            </div>
          )}
          {team.length === 0 && !building && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>还没确定员工，和 AI 聊一聊你需要哪些专家吧。</span>
          )}
        </div>
      </div>

      {/* AI 对话 */}
      <div className="zone ai-zone">
        <h3>和 AI 团队聊</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 260, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : (b.speaker ?? 'AI')}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}
          {busy && <div style={{ textAlign: 'center', color: '#7dd3fc', padding: 8 }}>AI 团队思考中…</div>}
        </div>

        {/* 网站预览入口 */}
        {siteCode && (
          <button className="primary" style={{ width: '100%', marginTop: 10 }} onClick={() => setShowSite(true)}>
            📱 看看我的网站
          </button>
        )}

        {/* 提交 */}
        {stage?.key === 's6' && siteCode && !submitted && (
          <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={submit}>
            🚀 提交作品
          </button>
        )}
        {submitted && <div className="bubble final" style={{ marginTop: 10 }}>✅ 作品已提交，马上上大屏。</div>}
      </div>

      {/* 对话输入 */}
      {!submitted && (
        <div className="row" style={{ marginTop: 10 }}>
          <textarea
            placeholder={stage?.key === 's4' ? '说说你需要哪些员工，或让 AI 帮你设计团队…' : '跟 AI 团队说…'}
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

      {/* 网站预览弹层 */}
      {showSite && siteCode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', zIndex: 999 }} onClick={() => setShowSite(false)}>
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}>
            <button className="primary" onClick={() => setShowSite(false)} style={{ padding: '8px 18px', borderRadius: 8 }}>关闭预览</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ width: 'min(390px, 94vw)', height: '86vh', background: '#fff', borderRadius: 24, border: '8px solid #1e293b', overflow: 'hidden' }}>
              <iframe srcDoc={siteCode} title="网站预览" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} onClick={(e) => e.stopPropagation()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
