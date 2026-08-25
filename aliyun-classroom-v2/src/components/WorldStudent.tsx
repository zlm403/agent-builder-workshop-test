'use client';
// =========================================================
// 《我的世界》学生端 —— 固定创作工作台
// 顶部「当前任务」永远同步老师在大屏发布的 Tips；
// 主体：我的生命 + 和 AI 一起创造 + ✨创作工具
// 创建走 Tips01 简化流程：一句话给 AI → 【试试看】→【让它进入世界】
// =========================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { findTip } from '@/lib/world/tips';
import { api } from '@/lib/basePath';
import { SPEC_BLOCKS, type LifeSpec, type SpecBlockKey, mergeSpec } from '@/lib/world/spec';

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

const DEFAULT_NAME = '我的生命';

// 创作工具：点按钮 = 触发对应 AI 模式
const TOOLS = [
  { id: 'start', label: '帮我开始', icon: '🚀', hint: '还没想法？让 AI 帮你起个头' },
  { id: 'make', label: '帮我实现', icon: '🔧', hint: '把想法变成生命会做的事' },
  { id: 'look', label: '帮我看看', icon: '👀', hint: '让它分析你的生命最近在干什么' },
  { id: 'again', label: '再试一次', icon: '🔄', hint: '按刚才的建议重新提交' },
];

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
  const [currentTip, setCurrentTip] = useState<string | null>(null); // 'tip01'...

  // 创建状态（Tips01 纯对话流程：AI 生成名字/颜色/形状/定义）
  const [createStep, setCreateStep] = useState<'idle' | 'preview' | 'in'>('idle');
  const [aiLine, setAiLine] = useState('');
  const [lifeText, setLifeText] = useState('');
  const [aiName, setAiName] = useState('');
  const [aiColor, setAiColor] = useState('#36CFC9');
  const [aiShape, setAiShape] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // AI 聊天状态
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const my = data?.myLife;
  const version = my ? my.activeVersion + 1 : 1;

  async function load() {
    try {
      const r = await fetch(api(`/api/world?anonymousId=${anonymousId}&sessionId=${sessionId}`));
      const d = await r.json();
      setData(d);
    } catch { /* noop */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [anonymousId, sessionId]);

  // 同步大屏当前 Tips → 顶部"当前任务"
  useEffect(() => {
    let closed = false;
    async function loadTip() {
      try {
        const r = await fetch(api('/api/world/popup'), { cache: 'no-store' });
        const d = await r.json();
        if (!closed) {
          const c = d.content as string | null;
          if (d.show && c && c.startsWith('tip')) setCurrentTip(c);
          else if (!d.show) setCurrentTip(null);
        }
      } catch { /* noop */ }
    }
    loadTip();
    const t = setInterval(loadTip, 2000);
    return () => { closed = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatLog]);

  // ---------- 创建（Tips01：纯对话，AI 生成名字/颜色/形状/定义） ----------

  async function startCreate() {
    const text = aiLine.trim();
    if (!text || busy) return;
    setBusy(true);
    setMsg('');
    try {
      // AI 基于这句话生成完整生命（mode=create）
      const res = await fetch(api('/api/world/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, message: text, mode: 'create' }),
      });
      const d = await res.json();
      if (d.draft && d.name) {
        setLifeText(d.draft);
        setAiName(d.name);
        if (d.color) setAiColor(d.color);
        if (d.shape) setAiShape(d.shape);
        setCreateStep('preview');
        setMsg('');
      } else {
        setAiLine('');
        setMsg(d.reply || 'AI 没有返回，再试一次');
      }
    } finally {
      setBusy(false);
    }
  }

  async function enterWorld(spec?: LifeSpec) {
    if (busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(api('/api/world/life'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymousId,
          name: aiName || DEFAULT_NAME,
          color: aiColor,
          version,
          text: lifeText,
          shape: aiShape || undefined,
          spec,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error?.message || '提交失败');
      } else {
        setMsg(version === 1 ? '🎉 你的生命进入世界了！' : '✅ 新版本已生效');
        setCreateStep('in');
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  // ---------- AI 聊天 / 创作工具 ----------

  async function chat(text: string, mode: 'create' | 'observe') {
    if (chatBusy) return;
    setChatBusy(true);
    setChatLog((log) => [...log, { role: 'user', text }]);
    try {
      const res = await fetch(api('/api/world/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, message: text, mode }),
      });
      const d = await res.json();
      setChatLog((log) => [...log, { role: 'ai', text: d.reply || '（AI 暂时没有回复，稍后再试）' }]);
      if (d.draft) setLifeText(d.draft);
    } finally {
      setChatBusy(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatInput('');
    await chat(text, my ? 'observe' : 'create');
  }

  async function useTool(toolId: string) {
    if (chatBusy) return;
    const t = TOOLS.find((x) => x.id === toolId);
    if (!t) return;
    setChatOpen(true);
    if (toolId === 'again') {
      if (my) await enterWorld();
      return;
    }
    const promptByTool: Record<string, string> = {
      start: '我还不太知道想创造什么，帮我起个头，给我一个最小生命的样子。',
      make: '我有一个想法，帮我把它变成我的生命真的会做的事情。我的想法是：' + (lifeText || my?.text || '（我还没写，先帮我示范一下）'),
      look: '帮我看看我的生命最近在做什么、为什么这样做，有什么值得注意的？',
    };
    await chat(promptByTool[toolId] ?? '', toolId === 'look' ? 'observe' : 'create');
  }

  const tip = findTip(currentTip);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ===== 顶部：当前任务（永远同步 Tips） ===== */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)' }}>
        <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, letterSpacing: 1 }}>当前任务</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{tip ? tip.task : '先造一个生命，让它进入世界'}</div>
      </div>

      {/* ===== 我的生命（有生命时） ===== */}
      {my && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: my.color, display: 'inline-block' }} />
            <b style={{ fontSize: 18 }}>{my.name}</b>
            <span className={`pill ${my.state === 'active' ? 'green' : 'red'}`}>{my.state === 'active' ? '运行中' : '休眠'}</span>
          </div>
          <div style={{ display: 'flex', gap: 18, marginBottom: 8 }}>
            <Info label="能量" value={String(Math.round(my.energy))} />
            <Info label="当前行为" value={actionLabel(my.action)} />
          </div>
          <div style={{ padding: 9, background: 'rgba(56,189,248,0.08)', borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}>
            <b>为什么这样动：</b>{my.reason}
          </div>
          {my.text && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
              生命定义：{my.text}
            </div>
          )}
        </div>
      )}

      {/* ===== 创建（Tips01：还没生命时） ===== */}
      {!my && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>造一个生命</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
            用一句话告诉 AI 你想创造一个什么，不用想太多。
          </p>

          {createStep === 'idle' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={aiLine} onChange={(e) => setAiLine(e.target.value)} placeholder="我想创造一个喜欢帮助别人的小生命…" />
                <button className="primary" disabled={busy || !aiLine.trim()} onClick={startCreate}>{busy ? '…' : '告诉 AI'}</button>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                名字、颜色、形状，全都让 AI 帮你定。跟它说你想创造什么，聊好了就点「确认创造」。
              </p>
            </>
          )}

          {createStep === 'preview' && (
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, background: 'rgba(15,23,42,0.5)', borderRadius: 10, marginBottom: 10 }}>
                <LifePreview name={aiName} color={aiColor} shape={aiShape} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{aiName || '小生命'}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{lifeText}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => setCreateStep('idle')}>重来</button>
                <button className="primary" disabled={busy || locked} onClick={() => enterWorld(undefined)}>
                  {busy ? '…' : '✨ 确认创造，进入世界'}
                </button>
              </div>
            </>
          )}

          {createStep === 'in' && (
            <div style={{ padding: 12, background: 'rgba(34,197,94,0.12)', borderRadius: 10 }}>
              <b>🎉 它已经进入世界了！</b>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>回大屏或点「观察」看它在做什么。</div>
            </div>
          )}
          {msg && <p style={{ color: 'var(--green)', margin: '8px 0 0', fontSize: 13 }}>{msg}</p>}
        </div>
      )}

      {/* ===== ✨ 创作工具（4 个按钮） ===== */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>✨ 创作工具</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TOOLS.map((t) => (
            <button key={t.id} className="secondary" style={{ fontSize: 13, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}
              disabled={chatBusy || locked} onClick={() => useTool(t.id)}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <b style={{ fontSize: 13 }}>{t.label}</b>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== 和 AI 一起创造 ===== */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>💬 和 AI 一起创造</span>
          <button className="secondary" style={{ fontSize: 12 }} onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? '收起' : '打开'}</button>
        </div>
        {chatOpen && (
          <>
            <div ref={logRef} style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {chatLog.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {my
                    ? '把看到的现象告诉 AI，让它帮你分析、出主意。'
                    : '说说你希望它是怎样的生命，AI 帮你把它变成「生命定义」。'}
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
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder={my ? '比如：它为什么一直躲开别人？' : '比如：我想要一个爱帮助别人但会保护自己的生命'} />
              <button className="secondary" disabled={chatBusy || !chatInput.trim()} onClick={sendChat}>
                {chatBusy ? '…' : '发送'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== 六块设计（方案 A：逐块定义表现规格） ===== */}
      <SixBlockDesign
        anonymousId={anonymousId}
        name={my?.name || aiName}
        color={my?.color || aiColor}
        version={version}
        locked={locked}
        onCommit={(spec) => enterWorld(spec)}
      />
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

// 生命形状预览：SVG 字符串 → data URL → img 渲染（脚本不执行，安全）
function LifePreview({ name, color, shape }: { name: string; color: string; shape: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [shape]);
  const src = useMemo(() => {
    if (!shape) return '';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shape);
  }, [shape]);
  if (failed || !src) {
    return <div style={{ width: 72, height: 72, borderRadius: '50%', background: color, flexShrink: 0 }} />;
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: 72, height: 72, flexShrink: 0, objectFit: 'contain' }}
    />
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

// =========================================================
// 六块设计：学生逐块跟 AI 聊，AI 生成该块的表现规格片段，合并后提交。
// 每块独立对话 → extract 生成片段 → 六块完成 → mergeSpec → 提交。
// =========================================================

function blockLabel(key: SpecBlockKey): string {
  const map: Record<string, string> = {
    create: '创造', social: '交流', react: '反应',
    resource: '资源', trend: '潮流', grow: '成长',
  };
  return map[key] ?? key;
}

// 片段 → 学生可读的摘要文本
function describePart(key: SpecBlockKey, spec: Partial<LifeSpec>): string {
  const parts: string[] = [];
  const actionText = (acts: unknown, fallback: string): string => {
    if (!Array.isArray(acts) || acts.length === 0) return fallback;
    const names: Record<string, string> = {
      emitSelf: '吐小星星', lightLink: '光带连线', miniSelf: '飞出缩小版自己',
      scale: '缩放', dim: '变暗', glow: '发光', jitter: '抖动', flash: '闪光',
      bubble: '冒泡', cry: '掉泪', dance: '转圈', fade: '飘散',
      orbit: '绕行', nuzzle: '蹭一蹭', approach: '主动靠近', avoid: '躲开',
    };
    return acts.map((a) => (a as { do?: string }).do ? names[(a as { do: string }).do] ?? (a as { do: string }).do : '').filter(Boolean).join('、');
  };
  if (key === 'social') parts.push(`相遇：${actionText(spec.onMeet, '光带连线')}`);
  if (key === 'social' && spec.onWave?.length) parts.push(`交流：${actionText(spec.onWave, '主动靠近')}`);
  if (key === 'react') parts.push(`受击：${actionText(spec.onHit, '抖动')}`);
  if (key === 'resource') parts.push(`吃资源：${actionText(spec.onResource, '发光')}`);
  if (key === 'trend' && spec.mood) {
    const moods = Object.entries(spec.mood).map(([k, v]) => `${k}→${v === 'avoid' ? '躲开' : v === 'approach' ? '靠近' : v}`);
    if (moods.length) parts.push(`心情：${moods.join('、')}`);
  }
  if (key === 'grow') parts.push(`长大：${actionText(spec.onGrow, '变大')}；消失：${actionText(spec.onDeath, '飘散')}`);
  return parts.join('；') || '（默认表现）';
}

function SixBlockDesign({
  anonymousId, name, color, version, locked, onCommit,
}: {
  anonymousId: string;
  name: string;
  color: string;
  version: number;
  locked: boolean;
  onCommit: (spec: LifeSpec) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<SpecBlockKey>('create');
  const [parts, setParts] = useState<Partial<Record<SpecBlockKey, Partial<LifeSpec>>>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const doneCount = SPEC_BLOCKS.filter((b) => parts[b.key]).length;

  async function askBlock() {
    const text = input.trim();
    if (!text || busy || locked) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(api('/api/a3/llm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extract: true,
          block: activeKey,
          convo: text,
          fields: parts,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error || 'AI 没有返回，稍后再试');
      } else {
        setParts((p) => ({ ...p, [activeKey]: (d.spec && Object.keys(d.spec).length ? d.spec : undefined) }));
        setInput('');
        setDone(d.followup ? `已生成。${d.followup}` : `✅「${blockLabel(activeKey)}」设定已生成。`);
      }
    } catch {
      setError('网络问题，稍后再试');
    } finally {
      setBusy(false);
    }
  }

  async function commitAll() {
    if (busy || locked) return;
    const spec = mergeSpec(SPEC_BLOCKS.map((b) => parts[b.key]).filter(Boolean) as Partial<LifeSpec>[]);
    await onCommit(spec);
    setDone('🚀 六块设定已合并提交，新版本已生效！');
    setOpen(false);
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>🧩 六块设计 · 让它的表现完全像你</span>
        <button className="secondary" style={{ fontSize: 12 }} onClick={() => setOpen(!open)}>{open ? '收起' : '打开'}</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        按「创造 / 交流 / 反应 / 资源 / 潮流 / 成长」六块，逐块告诉 AI 你的生命会怎么表现。已完成 {doneCount}/6。
      </div>
      {open && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SPEC_BLOCKS.map((b) => {
              const has = !!parts[b.key];
              return (
                <button key={b.key}
                  className={activeKey === b.key ? 'primary' : 'secondary'}
                  style={{ fontSize: 12, padding: '6px 10px' }}
                  onClick={() => { setActiveKey(b.key); setInput(''); setDone(''); }}>
                  {b.title}{has ? ' ✓' : ''}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            <b>{blockLabel(activeKey)}</b> · {SPEC_BLOCKS.find((b) => b.key === activeKey)?.desc}
          </div>

          {parts[activeKey] && (
            <div style={{ padding: 9, background: 'rgba(34,197,94,0.1)', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
              <b>当前设定：</b>{describePart(activeKey, parts[activeKey]!)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') askBlock(); }}
              placeholder={`告诉我它${SPEC_BLOCKS.find((b) => b.key === activeKey)?.desc.replace('它', '') ?? ''}…`} />
            <button className="primary" disabled={busy || locked || !input.trim()} onClick={askBlock}>
              {busy ? '…' : '生成'}
            </button>
          </div>

          {error && <p style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
          {done && <p style={{ color: 'var(--green)', fontSize: 12, margin: '8px 0 0' }}>{done}</p>}

          <button className="primary" style={{ width: '100%', marginTop: 12 }} disabled={busy || locked || doneCount === 0} onClick={commitAll}>
            🚀 合并六块设定并提交我的生命
          </button>
        </>
      )}
    </div>
  );
}
