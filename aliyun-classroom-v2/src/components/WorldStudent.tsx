'use client';
// =========================================================
// 《我的世界》学生端：创建生命 → 提交 → 观察 → AI 讨论 → 修改 V2 → 比较
// =========================================================
import { useEffect, useState } from 'react';

interface MyLife {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  energy: number;
  state: 'active' | 'sleeping';
  action: string;
  reason: string;
  activeVersion: number;
  social: number;
  helpful: number;
  cautious: number;
  relations: Record<string, number>;
}

interface WorldData {
  status: string;
  round: number;
  simulationTime: number;
  lives: { id: string; name: string; color: string; state: string; action: string; reason: string }[];
  keyEvents: { t: number; text: string }[];
  myLife: MyLife | null;
}

const COLOR_CHOICES = ['#36CFC9', '#F3C84B', '#FF7A9C', '#7C9BFF', '#9BE15D', '#C77DFF'];

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
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [social, setSocial] = useState(0.5);
  const [helpful, setHelpful] = useState(0.5);
  const [cautious, setCautious] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/world?anonymousId=${anonymousId}&sessionId=${sessionId}`);
      const d = await r.json();
      setData(d);
      if (d.myLife) {
        setName(d.myLife.name);
        setColor(d.myLife.color);
        if (d.status === 'creating' || d.status === 'revising') {
          setSocial(d.myLife.social);
          setHelpful(d.myLife.helpful);
          setCautious(d.myLife.cautious);
        }
      }
    } catch { /* noop */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [anonymousId, sessionId]);

  const version = data?.round === 1 ? 1 : 2;
  const canCreate = data?.status === 'creating' && version === 1;
  const canRevise = data?.status === 'revising' && version === 2;

  async function submitLife() {
    if (!name.trim() || busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/world/life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, name: name.trim(), color, version, social, helpful, cautious }),
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

  async function askAI() {
    if (!aiInput.trim() || aiBusy) return;
    setAiBusy(true);
    setAiReply('');
    try {
      const res = await fetch('/api/world/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, message: aiInput.trim(), mode: data?.status === 'revising' ? 'suggest' : 'explain' }),
      });
      const d = await res.json();
      if (d.reply) setAiReply(d.reply);
      if (d.suggestion) {
        setSocial(d.suggestion.social ?? social);
        setHelpful(d.suggestion.helpful ?? helpful);
        setCautious(d.suggestion.cautious ?? cautious);
      }
    } finally {
      setAiBusy(false);
    }
  }

  const my = data?.myLife;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 阶段提示 */}
      <div style={{ fontSize: 14, color: 'var(--muted)' }}>
        {stageHint(data?.status ?? 'creating', data?.round ?? 1)}
      </div>

      {/* 创建 / 修改表单 */}
      {(canCreate || canRevise) && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0 }}>{canRevise ? '修改你的生命' : '创造你的生命'}</h2>
          <Field label="它叫什么名字？">
            <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="如：小光" />
          </Field>
          <Field label="给它选一个颜色">
            <div style={{ display: 'flex', gap: 8 }}>
              {COLOR_CHOICES.map((c) => (
                <div key={c} onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid #fff' : '2px solid transparent' }} />
              ))}
            </div>
          </Field>
          <Slider label="亲近倾向（多高会和别人靠近）" value={social} onChange={setSocial} />
          <Slider label="帮助倾向（多高会帮助别人）" value={helpful} onChange={setHelpful} />
          <Slider label="谨慎倾向（多高会回避拥挤）" value={cautious} onChange={setCautious} />
          <button className="primary" disabled={busy || locked || !name.trim()} onClick={submitLife}>
            {busy ? '提交中…' : canRevise ? '提交新版本' : '创建生命'}
          </button>
          {msg && <p style={{ color: 'var(--green)', margin: 0 }}>{msg}</p>}
        </div>
      )}

      {/* 我的生命观察 */}
      {my && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: my.color, display: 'inline-block' }} />
            <b style={{ fontSize: 18 }}>{my.name}</b>
            <span className={`pill ${my.state === 'active' ? 'green' : 'red'}`}>{my.state === 'active' ? '运行中' : '休眠'}</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Info label="能量" value={String(Math.round(my.energy))} />
            <Info label="当前行为" value={actionLabel(my.action)} />
          </div>
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(56,189,248,0.08)', borderRadius: 8, fontSize: 14 }}>
            <b>为什么这样动：</b>{my.reason}
          </div>
          {Object.keys(my.relations).length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
              重要关系：{Object.entries(my.relations).filter(([, v]) => v >= 40).map(([, v]) => Math.round(v)).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* AI 讨论 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>和 AI 聊聊</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={data?.status === 'revising' ? '比如：我希望它更愿意帮助别人，但别耗尽自己' : '比如：为什么我的生命休眠了？'} />
          <button className="secondary" disabled={aiBusy || !aiInput.trim()} onClick={askAI}>{aiBusy ? '思考中…' : '发送'}</button>
        </div>
        {aiReply && (
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(15,23,42,0.5)', borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap' }}>{aiReply}</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</label>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
        <span>{label}</span>
        <b>{Math.round(value * 100)}</b>
      </div>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} style={{ width: '100%' }} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
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

function stageHint(status: string, round: number): string {
  const map: Record<string, string> = {
    creating: '现在来创造你的生命。想好它是什么性格，再放进世界。',
    running: `世界正在运行（第 ${round} 轮），观察你的生命是怎么动的。`,
    revising: '现在可以修改一个倾向，下一轮看它会怎么变。',
    finished: '本轮体验结束。',
  };
  return map[status] ?? status;
}
