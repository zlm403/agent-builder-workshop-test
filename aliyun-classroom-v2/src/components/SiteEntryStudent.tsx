'use client';
// =========================================================
// P2 快速入门网站 · 学生端（六座山 · 十二阶段）
// 小屏四区：当前任务 / 与 AI 对话 / 阶段成果 / 提交（每阶段一个主要动作）
// 阶段由教师控制推进（subState p2:s1..s12）
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { P2_STAGES } from '@/features/siteEntry/config';
import { usePageOverrides } from '@/lib/usePageText';

interface Bubble {
  role: 'ai' | 'user';
  content: string;
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
  const ov = usePageOverrides(subState);
  const logRef = useRef<HTMLDivElement>(null);

  // 当前阶段（subState p2:sN → 0..11）
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^p2:(s\d+)$/);
    return m ? P2_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const isWall = String(subState ?? '') === 'p2:wall';
  const inHook = String(subState ?? '') === 'p2:hook' || stageIdx < 0;
  const stage = stageIdx >= 0 ? P2_STAGES[stageIdx] : null;

  // 勾选状态（s4）
  const [pickedQ, setPickedQ] = useState<string[]>([]);
  const [q5, setQ5] = useState<string[]>([]);

  // s5 内容生成
  const [contentNote, setContentNote] = useState('');
  // s6 生成网页
  const [siteCode, setSiteCode] = useState<string | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [chosenStyle, setChosenStyle] = useState('');
  const [showSite, setShowSite] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // s7 自检三问
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>({ c1: false, c2: false, c3: false });
  // s8 同伴测试反馈
  const [peerAnswer, setPeerAnswer] = useState<Record<string, string>>({});
  const [peerConfused, setPeerConfused] = useState('');
  const [peerNoStep, setPeerNoStep] = useState('');
  // s10 迁移挑战
  const [challenge, setChallenge] = useState('');

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
        if (d.knowledgeQs) {
          const arr = String(d.knowledgeQs).split('\n').filter(Boolean);
          if (arr.length) setQ5(arr);
        }
        if (d.submittedAt) setSubmitted(true);
        if (!d.chatLog || d.chatLog.length === 0) {
          setBubbles([{ role: 'ai', content: '你好！今天我们要做一个帮「零基础的人」快速进入某个领域的入门网站。\n\n你想帮别人进入哪个领域？随便说，咖啡、摄影、健身……都可以。' }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles]);

  async function send() {
    const text = input.trim();
    if (!text || busy || locked || !stage) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: stage.key, message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      if (d.reply) {
        setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
        // s3：AI 返回 5 个问题 → 解析成可勾选列表
        if (stage.key === 's3') {
          const lines = String(d.reply).split('\n').map((l) => l.trim()).filter((l) => /^\d+[.、]/.test(l));
          if (lines.length >= 3) setQ5(lines.map((l) => l.replace(/^\d+[.、]\s*/, '')));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitPicked() {
    if (busy || pickedQ.length < 3 || !stage) return;
    setBusy(true);
    try {
      const res = await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 's4', picked: pickedQ }),
      });
      const d = await res.json();
      if (d.reply) setBubbles((b) => [...b, { role: 'user', content: '我选这 3 个核心问题。' }, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
  }

  // s6 生成网页（手机上操作）
  async function generateSite() {
    if (genBusy || !stage) return;
    setGenBusy(true);
    setContentNote('');
    try {
      const res = await fetch('/api/site-entry/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'generate', style: chosenStyle }),
      });
      const d = await res.json();
      if (d.code) {
        setSiteCode(d.code);
        setContentNote('网页已生成，点「看看效果」在手机上预览。不满意就跟 AI 说哪里要改。');
      } else if (d.error) {
        setContentNote(`生成失败：${d.error?.message || '请重试'}`);
      }
    } finally {
      setGenBusy(false);
    }
  }

  // s6 让 AI 列风格 → 存到 styles 供点选
  async function askStyles() {
    if (busy || !stage) return;
    setBusy(true);
    try {
      const res = await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 's6', message: '你能给我列几种网站风格吗？我去选。' }),
      });
      const d = await res.json();
      if (d.reply) {
        setBubbles((b) => [...b, { role: 'user', content: '你能给我列几种网站风格吗？我去选。' }, { role: 'ai', content: d.reply }]);
        // 尝试从回复里提取风格词
        const candidates = String(d.reply).match(/[\u4e00-\u9fa5]{2,6}(?:·[\u4e00-\u9fa5]{2,6})?/g) ?? [];
        if (candidates.length >= 2) setStyles(candidates.slice(0, 6));
      }
    } finally {
      setBusy(false);
    }
  }

  // s9 把同伴反馈转给 AI 修改
  async function sendFeedbackToAI() {
    if (busy || !stage || !(peerConfused || peerNoStep)) return;
    setBusy(true);
    try {
      const fb = [peerConfused && `测试者在「${peerConfused}」处看不懂`, peerNoStep && `不知道怎么做「${peerNoStep}」`].filter(Boolean).join('；');
      const msg = `测试者给出了反馈：${fb}。请先判断具体问题，再修改网页，不要改动无关内容。`;
      const res = await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 's9', message: msg }),
      });
      const d = await res.json();
      if (d.reply) {
        setBubbles((b) => [...b, { role: 'user', content: msg }, { role: 'ai', content: d.reply }]);
        setContentNote('已把反馈交给 AI。如果它说要改，你可以再生成一版看看。');
      }
    } finally {
      setBusy(false);
    }
  }

  // s12 提交结课句
  async function submitClosing() {
    const text = input.trim();
    if (!text || busy || !stage) return;
    setBusy(true);
    try {
      await fetch('/api/site-entry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: 's12', message: `结课句：${text}` }),
      });
      setInput('');
      setBubbles((b) => [...b, { role: 'user', content: `今天我原本不会___，后来我通过___，做出了___ → ${text}` }, { role: 'ai', content: '说得真好！这就是你今天的收获。' }]);
    } finally {
      setBusy(false);
    }
  }

  // s11 提交作品
  async function submitWork() {
    if (submitting || !stage) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/site-entry/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, finalWork: '我的入门网站' }),
      });
      if (res.ok) {
        setSubmitted(true);
        setBubbles((b) => [...b, { role: 'ai', content: '作品已提交，马上上大屏！' }]);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="note">正在加载…</p>;
  }

  // 钩子/未进入阶段：看大屏
  if (inHook && !isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">今天我们要做一个帮「零基础的人」快速进入某个领域的入门网站。听老师讲开场。</p>
      </div>
    );
  }

  if (isWall) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">全班的入门网站已经上墙，看看大家的作品吧。</p>
      </div>
    );
  }

  return (
    <div className="ai-workspace">
      {/* 当前任务卡 */}
      <div className="zone" style={{ borderLeft: '4px solid #38bdf8' }}>
        <h3 style={{ color: '#38bdf8', margin: 0 }}>第 {stageIdx + 1} 阶段 · {stage?.name}</h3>
        <p className="task-hint" style={{ color: '#fde047', fontWeight: 600, lineHeight: 1.6, margin: '8px 0 4px' }}>{ov.screenTitle ?? stage?.screenTitle}</p>
        <p className="task-hint" style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{ov.studentTask ?? stage?.studentTask}</p>
      </div>

      <div className="zone ai-zone">
        <h3>和 AI 聊</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 260, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}
        </div>

        {/* s3：5 个问题勾选 3 个 */}
        {stage?.key === 's4' && q5.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>从这 5 个问题里勾选 3 个最关键的（你只需要 3 个）：</div>
            {q5.map((q, i) => {
              const checked = pickedQ.includes(q);
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && pickedQ.length >= 3}
                    onChange={() => setPickedQ((p) => (checked ? p.filter((x) => x !== q) : [...p, q]))}
                  />
                  <span style={{ color: checked ? '#7dd3fc' : '#cbd5e1' }}>{q}</span>
                </label>
              );
            })}
            <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={pickedQ.length !== 3 || busy} onClick={submitPicked}>
              {busy ? '提交中…' : '确定，这是我选的 3 个核心问题'}
            </button>
          </div>
        )}

        {/* s5：生成内容 · 按钮追问 */}
        {stage?.key === 's5' && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(134,239,172,0.06)', border: '1px solid rgba(134,239,172,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', marginBottom: 8 }}>把 3 个问题交给 AI 写内容</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
              在上面对话框告诉 AI："请用零基础的人能看懂的方式，把第一个问题讲清楚，给 3 个步骤和 1 个例子。" 写完不满意，点下面：
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['太长', '不具体', '看不懂', '第一步不明'].map((t) => (
                <button
                  key={t}
                  className="secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  disabled={busy}
                  onClick={async () => {
                    const q = q5[0] || '';
                    setBusy(true);
                    try {
                      const r = await fetch('/api/site-entry/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ anonymousId, sessionId, stage: 's5', message: `这段${t}，请改：${q}${t === '太长' ? '缩短一点' : t === '不具体' ? '给具体动作' : t === '看不懂' ? '换成日常语言' : '让第一步更明确'}` }),
                      });
                      const d = await r.json();
                      if (d.reply) setBubbles((b) => [...b, { role: 'user', content: `这段${t}，帮我改改。` }, { role: 'ai', content: d.reply }]);
                    } finally { setBusy(false); }
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* s6：选风格 + 生成网页 */}
        {stage?.key === 's6' && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>生成你的网站</div>
            {styles.length === 0 ? (
              <button className="secondary" style={{ width: '100%' }} disabled={busy} onClick={askStyles}>
                🎨 让 AI 列几种风格
              </button>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>选一个你喜欢的风格：</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {styles.map((s) => (
                    <button
                      key={s}
                      className={chosenStyle === s ? 'primary' : 'secondary'}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => setChosenStyle(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {chosenStyle && !siteCode && (
              <button className="primary" style={{ width: '100%', marginTop: 10 }} disabled={genBusy} onClick={generateSite}>
                {genBusy ? '生成中…' : '✦ 生成网站'}
              </button>
            )}
            {siteCode && (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="primary" style={{ flex: 1 }} onClick={() => setShowSite(true)}>📱 看看效果</button>
                </div>
                <p style={{ fontSize: 12, color: '#86efac', margin: '8px 0 0' }}>不满意？在下面对话框跟 AI 说哪里要改（如"我希望…但现在看到…请修改网页"）。</p>
              </>
            )}
            {contentNote && <p style={{ fontSize: 12, color: '#fde047', marginTop: 8 }}>{contentNote}</p>}
          </div>
        )}

        {/* s7：自检三问 */}
        {stage?.key === 's7' && siteCode && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fde047', marginBottom: 8 }}>自检三问 · 问自己</div>
            {[
              { q: '5 秒能看懂这个网站讲什么吗？', k: 'c1' },
              { q: '知道它是给谁用的吗？', k: 'c2' },
              { q: '第一步做什么很明显吗？', k: 'c3' },
            ].map((it) => {
              const val = selfCheck[it.k];
              return (
                <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                  <span style={{ flex: 1, color: '#e2e8f0' }}>{it.q}</span>
                  <button
                    className="secondary"
                    style={{ fontSize: 12, padding: '4px 12px', border: val === true ? '2px solid #86efac' : '1px solid var(--border)' }}
                    onClick={() => setSelfCheck((s) => ({ ...s, [it.k]: true }))}
                  >
                    能/是
                  </button>
                  <button
                    className="secondary"
                    style={{ fontSize: 12, padding: '4px 12px', border: val === false ? '2px solid #f87171' : '1px solid var(--border)' }}
                    onClick={() => setSelfCheck((s) => ({ ...s, [it.k]: false }))}
                  >
                    不能/不是
                  </button>
                </div>
              );
            })}
            {Object.values(selfCheck).includes(false) && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>发现问题，用模板跟 AI 说（自动带上）：</p>
                <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
                  我希望<strong style={{ color: '#fde047' }}>____</strong>，但现在看到<strong style={{ color: '#fde047' }}>____</strong>，请修改网页。
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>三问都过了？继续让 AI 修改，或等老师进入下一阶段。</p>
          </div>
        )}

        {/* s8：同伴测试 */}
        {stage?.key === 's8' && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(167,139,250,0.35)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 8 }}>同伴测试 · 让一个完全不懂的人来看</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
              把手机给旁边的人，请他<strong>不看你操作，独立看 2 分钟</strong>，然后回答三个问题，并告诉你哪里看不懂。
            </p>
            {[
              { k: 'a1', q: '① 这个网站是讲什么的？' },
              { k: 'a2', q: '② 它是给谁用的？' },
              { k: 'a3', q: '③ 第一步应该做什么？' },
            ].map((it) => (
              <div key={it.k} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 3 }}>{it.q}</div>
                <input
                  placeholder="朋友的回答…"
                  value={peerAnswer[it.k] ?? ''}
                  onChange={(e) => setPeerAnswer((p) => ({ ...p, [it.k]: e.target.value }))}
                  style={{ fontSize: 13 }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 3 }}>他哪里看不懂？</div>
              <input placeholder="我看不懂的是____" value={peerConfused} onChange={(e) => setPeerConfused(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 3 }}>他哪一步不知道怎么做？</div>
              <input placeholder="我不知道怎么做的是____" value={peerNoStep} onChange={(e) => setPeerNoStep(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>把朋友的反�馈记下来，下一步用它让 AI 改。</p>
          </div>
        )}

        {/* s9：根据反馈修改 */}
        {stage?.key === 's9' && siteCode && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fde047', marginBottom: 8 }}>根据同伴反馈修改</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
              把同伴的反馈转给 AI，先判断具体问题，再修改网页。已自动带上你记录的反馈：
            </p>
            <button className="primary" style={{ width: '100%' }} disabled={busy || !(peerConfused || peerNoStep)} onClick={sendFeedbackToAI}>
              {busy ? '处理中…' : '✦ 把反馈交给 AI 修改'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>
              模板：测试者在<strong style={{ color: '#fde047' }}>____</strong>处遇到<strong style={{ color: '#fde047' }}>____</strong>，请把<strong style={{ color: '#fde047' }}>____</strong>改得更清楚。
            </p>
          </div>
        )}

        {/* s10：能力迁移 */}
        {stage?.key === 's10' && siteCode && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.35)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', marginBottom: 8 }}>能力迁移 · 换一个任务，你还能做吗</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {['增加一个常见问题', '换一种目标读者', '增加一份行动清单'].map((c) => (
                <button
                  key={c}
                  className={challenge === c ? 'primary' : 'secondary'}
                  style={{ textAlign: 'left', fontSize: 13 }}
                  onClick={() => setChallenge(c)}
                >
                  {challenge === c ? '✓ ' : ''}{c}
                </button>
              ))}
            </div>
            {challenge && (
              <>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 6px' }}>
                  自己组织一句话告诉 AI，只给你三个提示：我要增加<strong style={{ color: '#86efac' }}>____</strong>；它是为了帮助<strong style={{ color: '#86efac' }}>____</strong>；完成标准是<strong style={{ color: '#86efac' }}>____</strong>。
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => setInput(`我要${challenge}，它是为了帮助____，完成标准是____。请你帮我改。`)}>
                    填入提示词
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* s12：升华 · 结课句 */}
        {stage?.key === 's12' && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>写在最后 · 一句话</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
              跟老师一起看大屏。最后用一句话说说你今天的变化：
            </p>
            <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 8 }}>
              今天我原本不会<strong style={{ color: '#38bdf8' }}>____</strong>，后来我通过<strong style={{ color: '#38bdf8' }}>____</strong>，做出了<strong style={{ color: '#38bdf8' }}>____</strong>。
            </div>
            <input
              placeholder="填进这句话…"
              value={input}
              disabled={locked}
              onChange={(e) => setInput(e.target.value)}
              style={{ fontSize: 13, marginBottom: 8 }}
            />
            <button className="primary" style={{ width: '100%' }} disabled={!input.trim()} onClick={submitClosing}>
              提交我的变化
            </button>
          </div>
        )}

        {/* s11：提交作品 */}
        {stage?.key === 's11' && siteCode && !submitted && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.35)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#86efac', marginBottom: 8 }}>你的网站做好了</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary" style={{ flex: 1 }} onClick={() => setShowSite(true)}>📱 再看看</button>
              <button className="primary" style={{ flex: 1 }} disabled={submitting} onClick={submitWork}>
                {submitting ? '提交中…' : '🚀 提交作品'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>提交后作品会上大屏，和全班一起看。</p>
          </div>
        )}

        {submitted && (
          <div className="bubble final" style={{ marginTop: 12 }}>
            <span className="who">✅</span>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>作品已提交</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>你的入门网站已同步到大屏。</div>
          </div>
        )}
      </div>

      {!submitted && (
        <div className="row" style={{ marginTop: 10 }}>
          <textarea
            placeholder={stage?.key === 's3' ? '让 AI 列出 5 个问题…' : '跟 AI 说…'}
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

      {/* 手机预览弹层（s6 生成网页后在手机上预览） */}
      {showSite && siteCode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', zIndex: 999 }}
          onClick={() => setShowSite(false)}
        >
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}>
            <button className="primary" onClick={() => setShowSite(false)} style={{ padding: '8px 18px', borderRadius: 8 }}>
              关闭预览
            </button>
          </div>
          {/* 手机框：模拟手机竖屏预览 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ width: 'min(390px, 94vw)', height: '86vh', background: '#fff', borderRadius: 24, border: '8px solid #1e293b', overflow: 'hidden', position: 'relative' }}>
              <iframe
                srcDoc={siteCode}
                title="入门网站预览"
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
