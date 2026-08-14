'use client';
// =========================================================
// P3 数字生命共生缸 · 学生端（十阶段）
// 小屏：当前任务 / 我的生命 / AI 助手 / 观察记录 / 提交
// 阶段由教师控制推进（subState p3:s1..s10 / p3:wall）
// 核心：选特质 → 设计规则 → AI 翻译 + 实验缸试运行 → 投入共生缸 → 观察 → 修改 → 二次运行
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { P3_STAGES, P3_TRAITS, P3_SHAPES, P3_TRAILS, P3_MOVEMENTS, P3_INTERACTIONS, P3_ABILITIES, P3_COSTS, P3_DEFAULT_DESIGN } from '@/features/growGame/config';
import LabTank from './LabTank';
import { usePageOverrides, pageText } from '@/lib/usePageText';

interface Bubble {
  role: 'ai' | 'user';
  content: string;
}

export default function GrowGameStudent({
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
  const initRef = useRef(false);

  // 当前阶段
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^p3:(s\d+)$/);
    return m ? P3_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const inTank = String(subState ?? '') === 'p3:wall';
  const inHook = String(subState ?? '') === 'p3:hook' || stageIdx < 0;
  const stage = stageIdx >= 0 ? P3_STAGES[stageIdx] : null;

  // 生命设计状态
  const [objectName, setObjectName] = useState('');
  const [trait, setTrait] = useState('');
  const [traitWhy, setTraitWhy] = useState('');
  const [traitKind, setTraitKind] = useState('真实的我');
  const [design, setDesign] = useState<any>({ ...P3_DEFAULT_DESIGN });
  const [submitted, setSubmitted] = useState(false);
  const [note, setNote] = useState('');
  const [observeText, setObserveText] = useState('');
  const [observeProblem, setObserveProblem] = useState('');
  const [modifyChoice, setModifyChoice] = useState('');
  const [compare, setCompare] = useState('');
  const [finalLine, setFinalLine] = useState('');

  // 加载已保存状态
  useEffect(() => {
    if (!anonymousId || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/grow-game/life?sessionId=${sessionId}&anonymousId=${anonymousId}`);
        const d = await res.json();
        if (d.objectName) setObjectName(d.objectName);
        if (d.trait) setTrait(d.trait);
        if (d.traitWhy) setTraitWhy(d.traitWhy);
        if (d.lifeDesign) setDesign({ ...P3_DEFAULT_DESIGN, ...d.lifeDesign });
        if (d.submittedAt) setSubmitted(true);
        if (!initRef.current) {
          initRef.current = true;
          if (!d.chatLog || (Array.isArray(d.chatLog) && d.chatLog.length === 0)) {
            setBubbles([{ role: 'ai', content: '欢迎来到共生缸！你想创造一个怎样的数字生命？\n\n它可以代表真实的你，也可以代表你想成为的某一部分。选一个你想表达的特点。' }]);
          }
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
      const res = await fetch('/api/grow-game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, stage: stage.key, message: text }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setBubbles((b) => [...b, { role: 'ai', content: `[系统提示] ${d.error?.message || 'AI 服务暂时不可用'}` }]);
        return;
      }
      if (d.reply) setBubbles((b) => [...b, { role: 'ai', content: d.reply }]);
    } finally {
      setBusy(false);
    }
  }

  // 保存设计
  async function saveLife() {
    if (!objectName.trim() || !trait || !design || busy) return;
    setBusy(true);
    try {
      await fetch('/api/grow-game/life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'save', objectName, trait, traitWhy, lifeDesign: design }),
      });
      setBubbles((b) => [...b, { role: 'ai', content: '你的生命设计已保存！接下来让 AI 把它翻译成规则，在实验缸里试试。' }]);
    } finally {
      setBusy(false);
    }
  }

  // 投入共生缸
  async function launchLife() {
    if (busy) return;
    setBusy(true);
    try {
      const finalWork = `我想创造一个${trait}的生命；设计：${objectName}`;
      await fetch('/api/grow-game/life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, mode: 'launch', finalWork }),
      });
      setSubmitted(true);
      setBubbles((b) => [...b, { role: 'ai', content: `🎉 ${objectName} 已经投入共生缸了！去看看它在里面怎么动吧。` }]);
    } finally {
      setBusy(false);
    }
  }

  // 提交观察/修改
  async function saveNote(n: object) {
    await fetch('/api/grow-game/life', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, sessionId, mode: 'note', note: n }),
    });
  }

  if (loading) {
    return <p className="note">正在加载共生缸…</p>;
  }

  // 钩子/未进入：看大屏
  if (inHook && !inTank) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">今天我们要创造一个数字生命，把它放进全班共同的共生缸。听老师讲开场。</p>
      </div>
    );
  }

  if (inTank) {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏 · 共生缸</div>
        <p className="note">你的生命已经投进去了，全班的生命都在大屏的共生缸里运行。观察它实际做了什么。</p>
      </div>
    );
  }

  return (
    <div className="ai-workspace">
      {/* 当前任务卡 */}
      <div className="zone" style={{ borderLeft: '4px solid #fb923c' }}>
        <h3 style={{ color: '#fb923c', margin: 0 }}>阶段 {stageIdx + 1} · {stage?.name}</h3>
        {pageText(ov, 'screenTitle', stage?.screenTitle ?? '') !== null && <p className="task-hint" style={{ color: '#fde047', fontWeight: 600, lineHeight: 1.6, margin: '8px 0 4px' }}>{pageText(ov, 'screenTitle', stage?.screenTitle ?? '')}</p>}
        {pageText(ov, 'studentTask', stage?.studentTask ?? '') !== null && <p className="task-hint" style={{ color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{pageText(ov, 'studentTask', stage?.studentTask ?? '')}</p>}
      </div>

      {/* 生命设计器（s2-s4） */}
      {(stage?.key === 's2' || stage?.key === 's3' || stage?.key === 's4') && (
        <div className="zone" style={{ border: '1px solid rgba(251,146,60,.3)', background: 'rgba(251,146,60,.05)' }}>
          <h3 style={{ color: '#fb923c', margin: '0 0 10px' }}>我的生命</h3>

          {/* 名字 */}
          <input placeholder="给它起个名字（如：慢慢光）" value={objectName} onChange={(e) => setObjectName(e.target.value)} style={{ fontSize: 13, marginBottom: 8 }} />

          {/* s2 特质 */}
          {stage?.key === 's2' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>我想创造一个____的生命：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_TRAITS.map((t) => (
                  <button key={t} className={trait === t ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setTrait(t)}>{t}</button>
                ))}
              </div>
              <input placeholder="为什么选这个特点？（一句话）" value={traitWhy} onChange={(e) => setTraitWhy(e.target.value)} style={{ fontSize: 13, marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>它更接近：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {['真实的我', '想成为的自己', '两者都有', '完全虚构'].map((k) => (
                  <button key={k} className={traitKind === k ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setTraitKind(k)}>{k}</button>
                ))}
              </div>
            </>
          )}

          {/* s3 设计卡 */}
          {stage?.key === 's3' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>外形（形状 / 轨迹）：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                {P3_SHAPES.map((s) => (
                  <button key={s} className={design.shape === s ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '5px 9px' }} onClick={() => setDesign((d: any) => ({ ...d, shape: s }))}>{s}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_TRAILS.map((t) => (
                  <button key={t} className={design.trail === t ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '5px 9px' }} onClick={() => setDesign((d: any) => ({ ...d, trail: t }))}>{t}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>它怎样移动？</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_MOVEMENTS.map((m) => (
                  <button key={m.v} className={design.movement === m.v ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setDesign((d: any) => ({ ...d, movement: m.v }))}>{m.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>它遇到其他生命会怎样？</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_INTERACTIONS.map((m) => (
                  <button key={m.v} className={design.interaction === m.v ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setDesign((d: any) => ({ ...d, interaction: m.v }))}>{m.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>它的特殊能力：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_ABILITIES.map((m) => (
                  <button key={m.v} className={design.ability === m.v ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setDesign((d: any) => ({ ...d, ability: m.v }))}>{m.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 6 }}>使用能力的代价（每个能力必须有限制）：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {P3_COSTS.map((m) => (
                  <button key={m.v} className={design.cost === m.v ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setDesign((d: any) => ({ ...d, cost: m.v }))}>{m.label}</button>
                ))}
              </div>
            </>
          )}

          <button className="primary" style={{ width: '100%' }} disabled={!objectName.trim() || !trait || busy} onClick={saveLife}>
            {busy ? '保存中…' : '💾 保存我的生命设计'}
          </button>
        </div>
      )}

      {/* s4 实验缸试运行 */}
      {stage?.key === 's4' && objectName && trait && (
        <div className="zone" style={{ border: '1px solid rgba(56,189,248,.3)', background: 'rgba(56,189,248,.04)' }}>
          <h3 style={{ color: '#38bdf8', margin: '0 0 8px' }}>🧪 个人实验缸</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
            先在这里试试你的生命：它会怎么动？被事件撞一下什么感觉？跟邻居碰一下什么感觉？试完满意再投进全班共生缸。
          </p>
          <LabTank name={objectName} trait={trait} design={design} hue={design.hue ?? 190} />
          <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={submitted || busy} onClick={launchLife}>
            {submitted ? '✅ 已投入共生缸' : '🚀 投入共生缸'}
          </button>
        </div>
      )}

      {/* s6 观察 */}
      {stage?.key === 's6' && (
        <div className="zone" style={{ border: '1px solid rgba(124,58,237,.3)', background: 'rgba(124,58,237,.05)' }}>
          <h3 style={{ color: '#c4b5fd', margin: '0 0 8px' }}>🔍 观察记录</h3>
          <textarea placeholder="我实际看到的是…（它移动/相遇/能力发挥得怎么样）" value={observeText} onChange={(e) => setObserveText(e.target.value)} style={{ fontSize: 13, minHeight: 60 }} />
          <textarea placeholder="我认为需要解决的问题是…" value={observeProblem} onChange={(e) => setObserveProblem(e.target.value)} style={{ fontSize: 13, minHeight: 60, marginTop: 6 }} />
          <button className="secondary" style={{ width: '100%', marginTop: 8 }} disabled={!observeProblem || busy} onClick={async () => { await saveNote({ observe: observeText, problem: observeProblem }); setBubbles((b) => [...b, { role: 'ai', content: '观察已记录。下一步修改它。' }]); }}>
            记录我的观察
          </button>
        </div>
      )}

      {/* s7 修改 */}
      {stage?.key === 's7' && (
        <div className="zone" style={{ border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.05)' }}>
          <h3 style={{ color: '#fde047', margin: '0 0 8px' }}>✏️ 修改我的生命</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>修改方向（只改一个最关键的）：</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {['移动规则', '相遇规则', '特殊能力', '能力代价', '外形', '增加行为条件'].map((c) => (
              <button key={c} className={modifyChoice === c ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setModifyChoice(c)}>{c}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            在对话框告诉 AI："我原来希望它____，但实际运行时____，所以我要把____改成____。" AI 会给你两个方案，你选一个。
          </p>
        </div>
      )}

      {/* s8 二次运行判断 */}
      {stage?.key === 's8' && (
        <div className="zone" style={{ border: '1px solid rgba(134,239,172,.3)', background: 'rgba(134,239,172,.05)' }}>
          <h3 style={{ color: '#86efac', margin: '0 0 8px' }}>🔁 修改后，更接近你的想法吗？</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {['更接近我的想法', '问题解决了一部分', '没有明显改善', '出现了新的问题', '第一版反而更好'].map((c) => (
              <button key={c} className={compare === c ? 'primary' : 'secondary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setCompare(c)}>{c}</button>
            ))}
          </div>
          <input placeholder="我最终保留这个版本，因为…" value={finalLine} onChange={(e) => setFinalLine(e.target.value)} style={{ fontSize: 13 }} />
        </div>
      )}

      {/* s9 过程卡 */}
      {stage?.key === 's9' && (
        <div className="zone" style={{ border: '1px solid rgba(56,189,248,.3)', background: 'rgba(56,189,248,.05)' }}>
          <h3 style={{ color: '#38bdf8', margin: '0 0 8px' }}>📋 我的创造过程卡</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>
            我想创造一个<strong style={{ color: '#fde047' }}>{trait || '____'}</strong>的生命；
            <br />AI 帮助我把它变成了<strong style={{ color: '#fde047' }}>{objectName || '____'}</strong>；
            <br />第一次运行时，我发现<strong style={{ color: '#fde047' }}>{observeProblem || '____'}</strong>；
            <br />所以我把<strong style={{ color: '#fde047' }}>{modifyChoice || '____'}</strong>改成了<strong style={{ color: '#fde047' }}>____</strong>；
            <br />最终我保留这个版本，因为<strong style={{ color: '#fde047' }}>{finalLine || '____'}</strong>。
          </p>
        </div>
      )}

      {/* AI 对话 */}
      <div className="zone ai-zone">
        <h3>和 AI 聊</h3>
        <div className="chat-log" ref={logRef} style={{ maxHeight: 220, overflowY: 'auto' }}>
          {bubbles.map((b, i) => (
            <div key={i} className={`bubble ${b.role}`}>
              <span className="who">{b.role === 'user' ? '你' : 'AI'}</span>
              <span className="text">{b.content}</span>
            </div>
          ))}
        </div>
        {!submitted && (
          <div className="row" style={{ marginTop: 8 }}>
            <textarea
              placeholder={stage?.key === 's7' ? '告诉我：你原来希望它____，但看到____，所以要改成____' : '跟 AI 说…'}
              value={input}
              disabled={locked || busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
              style={{ minHeight: 48 }}
            />
            <button className="secondary" disabled={busy || locked || !input.trim()} onClick={send}>
              {busy ? '思考中…' : '发送'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
