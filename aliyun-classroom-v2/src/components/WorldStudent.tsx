'use client';
// =========================================================
// 《我的世界》学生端（文字驱动，无滑杆）
// 分步：第1步 它是谁（名字+颜色）→ 第2步 生命定义（文字，可和 AI 聊）→ 第3步 确认提交
// 运行时：我的生命卡片（当前行为+原因）+ 和 AI 聊聊（分析观察）
// 修改阶段：重写生命定义 → 提交新版本
// =========================================================
import { useEffect, useRef, useState } from 'react';

interface MyLife {
  id: string;
  name: string;
  color: string;
  energy: number;
  state: 'active' | 'sleeping';
  action: string;
  reason: string;
  activeVersion: number;
  relations: Record<string, number>;
  text?: string;
}

interface WorldData {
  status: string;
  round: number;
  lives: { id: string; name: string; color: string; state: string; action: string; reason: string }[];
  keyEvents: { t: number; text: string }[];
  myLife: MyLife | null;
}

const COLOR_CHOICES = ['#36CFC9', '#F3C84B', '#FF7A9C', '#7C9BFF', '#9BE15D', '#C77DFF'];

const STAGE_HINT: Record<string, string> = {
  creating: '第1步 · 它是谁',
  running: '世界正在运行，看看你的生命在做什么',
  revising: '修改阶段 · 重写它的生命定义，下一轮看变化',
  finished: '本轮体验结束',
};

export default function WorldStudent({
  anonymousId,
  sessionId,
  locked,
}: {
  anonymousId: string;
  sessionId: string;
  locked: boolean;
}) {
  const [data, setData] = useState<WorldData | null>(null);

  // 分步表单状态
  const [step, setStep] = useState(1); // 1名字/2定义/3确认
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [lifeText, setLifeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // AI 聊天状态
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const my = data?.myLife;
  const creating = data?.status === 'creating';
  const revising = data?.status === 'revising';
  const canEdit = creating || revising;
  const version = data?.round === 1 ? 1 : 2;

  async function load() {
    try {
      const r = await fetch(`/api/world?anonymousId=${anonymousId}&sessionId=${sessionId}`);
      const d = await r.json();
      setData(d);
      if (d.myLife) {
        if (!name) setName(d.myLife.name);
        if (step === 1) setColor(d.myLife.color);
        if (revising && !lifeText) setLifeText(d.myLife.text || '');
      }
    } catch { /* noop */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [anonymousId, sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatLog]);

  // 进入/刷新：预填草稿里的生命定义
  useEffect(() => {
    if (my?.text && !lifeText && (creating || revising)) setLifeText(my.text || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [my?.id]);

  async function askAI() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatBusy(true);
    setChatInput('');
    setChatLog((log) => [...log, { role: 'user', text }]);
    try {
      const mode = creating || revising ? 'create' : 'observe';
      const res = await fetch('/api/world/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, message: text, mode }),
      });
      const d = await res.json();
      const reply = d.reply || '（AI 暂时没有回复，稍后再试）';
      setChatLog((log) => [...log, { role: 'ai', text: reply }]);
      if (d.draft) {
        setDraft(d.draft);
        setLifeText(d.draft); // 直接填入生命定义
      }
    } finally {
      setChatBusy(false);
    }
  }

  async function submitLife() {
    if (!name.trim() || busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/world/life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, name: name.trim(), color, version, text: lifeText }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error?.message || '提交失败');
      } else {
        setMsg(version === 1 ? '生命已创建，等待老师发布到世界。' : '新版本已提交，等待老师开启第二轮。');
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 阶段提示条 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>
        {STAGE_HINT[data?.status ?? 'creating'] ?? data?.status}
      </div>

      {/* ===== 创建/修改：分步表单 ===== */}
      {canEdit && (
        <div className="card" style={{ padding: 20 }}>
          <StepHeader step={step} />

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>它叫什么名字？</label>
                <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="如：小光" />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>给它选一个颜色</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {COLOR_CHOICES.map((c) => (
                    <div key={c} onClick={() => setColor(c)}
                      style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <button className="primary" disabled={!name.trim()} onClick={() => setStep(2)}>下一步</button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>
                  生命定义 · 它喜欢怎样行动？
                </label>
                <textarea
                  value={lifeText}
                  onChange={(e) => setLifeText(e.target.value)}
                  placeholder={'写一段话描述你的生命，比如：\n"它热热闹闹爱交朋友，看到能量不足的朋友会去帮它，但人太多太挤时它会躲开。"\n\n也可以点下方「和 AI 聊」，让 AI 帮你想。'}
                  style={{ minHeight: 120 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="secondary" disabled={chatBusy} onClick={() => setChatOpen(true)}>💬 和 AI 聊</button>
                {draft && (
                  <button className="secondary" style={{ color: 'var(--green)' }} onClick={() => setLifeText(draft)}>把 AI 的定义填进来</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => setStep(1)}>上一步</button>
                <button className="primary" disabled={!lifeText.trim()} onClick={() => setStep(3)}>下一步</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 14, background: 'rgba(15,23,42,0.5)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <b style={{ fontSize: 17 }}>{name || '无名'}</b>
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{lifeText}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => setStep(2)}>上一步</button>
                <button className="primary" disabled={busy || locked} onClick={submitLife}>
                  {busy ? '提交中…' : version === 1 ? '确认，加入世界' : '提交新版本'}
                </button>
              </div>
              {msg && <p style={{ color: 'var(--green)', margin: 0 }}>{msg}</p>}
            </div>
          )}
        </div>
      )}

      {/* ===== 我的生命卡片（运行时） ===== */}
      {my && !canEdit && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: my.color, display: 'inline-block' }} />
            <b style={{ fontSize: 18 }}>{my.name}</b>
            <span className={`pill ${my.state === 'active' ? 'green' : 'red'}`}>{my.state === 'active' ? '运行中' : '休眠'}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
            <Info label="能量" value={String(Math.round(my.energy))} />
            <Info label="当前行为" value={actionLabel(my.action)} />
          </div>
          <div style={{ padding: 10, background: 'rgba(56,189,248,0.08)', borderRadius: 8, fontSize: 14, lineHeight: 1.6 }}>
            <b>为什么这样动：</b>{my.reason}
          </div>
          {Object.keys(my.relations).length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              重要关系：{Object.entries(my.relations).filter(([, v]) => v >= 40).map(([, v]) => Math.round(v)).join(' · ') || '（还没有深交的伙伴）'}
            </div>
          )}
          {my.text && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
              生命定义：{my.text}
            </div>
          )}
        </div>
      )}

      {/* ===== 和 AI 聊聊 ===== */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>和 AI 聊聊</span>
          {chatOpen ? (
            <button className="secondary" style={{ fontSize: 12 }} onClick={() => setChatOpen(false)}>收起</button>
          ) : (
            <button className="secondary" style={{ fontSize: 12 }} onClick={() => setChatOpen(true)}>打开</button>
          )}
        </div>
        {chatOpen && (
          <>
            <div ref={logRef} style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {chatLog.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {creating || revising
                    ? '说说你希望它是怎样的生命，AI 帮你写「生命定义」。'
                    : '把它最近的行为告诉 AI，让它帮你分析"这是怎么回事、怎么玩、要不要改"。'}
                </div>
              ) : (
                chatLog.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    background: m.role === 'user' ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)',
                    padding: '8px 12px', borderRadius: 10, maxWidth: '85%', fontSize: 13, whiteSpace: 'pre-wrap',
                  }}>
                    {m.text}
                  </div>
                ))
              )}
              {chatBusy && <div style={{ fontSize: 12, color: 'var(--muted)' }}>AI 思考中…</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') askAI(); }}
                placeholder={creating || revising ? '比如：我想要一个爱帮助别人但会保护自己的生命' : '比如：它为什么一直躲开别人？'} />
              <button className="secondary" disabled={chatBusy || !chatInput.trim()} onClick={askAI}>
                {chatBusy ? '…' : '发送'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepHeader({ step }: { step: number }) {
  const steps = ['它是谁', '生命定义', '确认提交'];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <span key={n} style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 999,
            background: active ? 'rgba(56,189,248,0.25)' : done ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.1)',
            border: active ? '1px solid var(--blue)' : done ? '1px solid var(--green)' : '1px solid var(--border)',
            color: active ? 'var(--blue)' : done ? 'var(--green)' : 'var(--muted)',
          }}>
            {done ? '✓ ' : ''}{n}. {s}
          </span>
        );
      })}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function actionLabel(a: string): string {
  const map: Record<string, string> = {
    wander: '自由探索',
    find_resource: '寻找资源',
    approach: '靠近伙伴',
    approach_help: '去帮助伙伴',
    help: '帮助伙伴',
    avoid: '回避',
    sleeping: '休眠',
  };
  return map[a] ?? a;
}
