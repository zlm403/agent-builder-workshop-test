'use client';

import { useEffect, useRef, useState } from 'react';
import VocabBrowser from '@/components/VocabBrowser';
import { vocabText } from '@/lib/vocab';
import { compareRounds } from '@/lib/analytics';
import { KNOWLEDGE_DOCS, SKILL_BLOCKS } from '@/lib/courseConfig';
import AvatarA0Screen from '@/components/AvatarA0Screen';
import AvatarA1Screen from '@/components/AvatarA1Screen';
import SiteEntryScreen from '@/components/SiteEntryScreen';
import WorldScreen from '@/components/WorldScreen';
import FourWingsScreen from '@/components/FourWingsScreen';
import PainWallScreen from '@/components/PainWallScreen';
import PriceRevealScreen from '@/components/PriceRevealScreen';
import ContentPage from '@/components/ContentPage';

interface Summary {
  status: string;
  currentModuleId: string | null;
  moduleLocked: boolean;
  moduleSubState?: string | null;
  totalStudents: number;
  onlineStudents: number;
  overview: { moduleId: string; title: string; completed: number; inProgress: number; stuck: number; notStarted: number }[];
}
interface ModuleDef {
  id: string;
  title: string;
  type: string;
  teacherContent?: Record<string, any>;
  screenContent?: Record<string, any>;
}
interface Analytics {
  total: number;
  metrics: { entered: number; firstCall: number; usedMaterial: number; iterated: number; verified: number; submitted: number; modified: number };
  aiStyle: { label: string; pct: number }[];
  taskClarity: { label: string; pct: number }[];
  materialUsage: { label: string; pct: number }[];
  styleCounts?: { one_shot: number; multi_round: number; stepwise: number };
  dimensions?: { key: string; label: string; pct: number }[];
  pathDistribution?: { key: string; label: string; count: number; pct: number }[];
  artifactDistribution?: { key: string; label: string; count: number; pct: number }[];
  classInsight?: string;
}
interface ScreeningSample {
  anonymousId: string;
  answer: string;
  label: string;
  dims: { tools: boolean; task: boolean; result: boolean; action: boolean };
}
interface ScreeningData {
  total: number;
  submitted: number;
  labels: { tool_user: number; task_solver: number; app_creator: number };
  revealSamples: ScreeningSample[];
}

export default function ScreenPage() {
  const [sessionId, setSessionId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [module, setModule] = useState<ModuleDef | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [screening, setScreening] = useState<ScreeningData | null>(null);
  const [meta, setMeta] = useState<{ inviteCode: string; courseName: string; createdAt: string | null; scheduledStartAt: string | null } | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [qr, setQr] = useState<{ dataUrl: string; joinUrl: string } | null>(null);
  const [hostname, setHostname] = useState('');
  const [effectiveHost, setEffectiveHost] = useState('');
  const esRef = useRef<EventSource | null>(null);
  const [thoughts, setThoughts] = useState<{ id: string; text: string; anonymousId: string; createdAt: string }[]>([]);
  // 刷新时不闪过 A00Screen 开场页，先显示"加载中"等首次 load 返回
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHostname(window.location.hostname);
    // 二维码实际生效地址：优先用配置好的对外公开地址，否则用打开大屏的地址
    const pub = process.env.NEXT_PUBLIC_APP_URL;
    const eb = pub && !new URL(pub).hostname.includes('localhost') ? pub : window.location.origin;
    setEffectiveHost(new URL(eb).hostname);
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('sessionId');
    if (!idParam) return;

    let closed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      let id = idParam;
      // 校验 session 是否存在，不存在则回退到最新有效 session
      const check = await fetch(`/api/classroom/${id}`);
      if (!check.ok) {
        try {
          const latest = await (await fetch('/api/classroom/latest')).json();
          if (latest?.id) {
            id = latest.id;
            const url = new URL(window.location.href);
            url.searchParams.set('sessionId', id);
            window.history.replaceState({}, '', url);
          }
        } catch { /* ignore */ }
      }
      if (closed) return;
      setSessionId(id);
      load(id);

      // 启动 SSE
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      function connect() {
        if (closed) return;
        const es = new EventSource(`/api/events/${id}`);
        esRef.current = es;
        es.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt.type === 'progress:update') setSummary(evt.payload);
            if (evt.type === 'module:advanced' || evt.type === 'module:locked' || evt.type === 'module:substate') load(id);
            if (evt.type === 'classroom:reset') load(id);
            if (evt.type === 'classroom:closed') load(id);
            if (evt.type === 'analytics:update') { if (module?.id) fetchAnalytics(id, module.id); fetchScreening(id); }
            if (evt.type === 'thought:new') {
              const t = evt.payload as { id: string; text: string; anonymousId: string; createdAt: string };
              if (t?.text) setThoughts((prev) => [t, ...prev].slice(0, 80));
            }
          } catch {
            /* noop */
          }
        };
        es.onerror = () => {
          console.warn('SSE error, reconnecting...');
          es.close();
          retryTimer = setTimeout(connect, 3000);
        };
      }
      connect();
      // SSE 断连或漏事件时的兜底：每 15 秒主动拉一次最新状态（降低频率以缓解连接池压力）
      const poll = setInterval(() => load(id), 15000);
      cleanup = () => {
        if (retryTimer) clearTimeout(retryTimer);
        clearInterval(poll);
        esRef.current?.close();
      };
    })();

    return () => {
      closed = true;
      cleanup?.();
    };
  }, []);

  async function load(id: string) {
    try {
      const res = await fetch(`/api/classroom/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = await res.json();
      setSummary(s.summary);
      setModule(s.currentModule ?? null);
      setStartedAt(s.moduleStartedAt ?? null);
      setMeta({ inviteCode: s.inviteCode, courseName: s.courseName, createdAt: s.createdAt, scheduledStartAt: s.scheduledStartAt ?? null });
      fetchQr(id);
      fetchThoughts(id);
      setLoading(false);
      const cur = s.currentModule;
      if (cur?.type === 'ai_task') {
        if (cur.screenContent?.phase === 'redo') fetchAnalytics(id, cur.id);
        else fetchAnalytics(id, 'A01_BASELINE');
      } else if (cur?.type === 'class_mirror') {
        fetchAnalytics(id, 'A01_BASELINE');
      } else if (cur?.type === 'hr_screening') fetchScreening(id);
    } catch (err) {
      // 加载失败不再抛错：关闭 loading、保留 SSE/poll 后续自愈，避免大屏永久卡在"加载中"
      console.warn('screen load failed for', id, err);
      setLoading(false);
    }
  }
  async function fetchAnalytics(id: string, moduleId = 'A01_BASELINE') {
    try {
      const a = await (await fetch(`/api/analytics?sessionId=${id}&moduleId=${moduleId}`)).json();
      setAnalytics(a);
    } catch {
      /* noop */
    }
  }
  async function fetchScreening(id: string) {
    try {
      const d = await (await fetch(`/api/screening/analytics?sessionId=${id}`)).json();
      setScreening(d);
    } catch {
      /* noop */
    }
  }
  async function fetchQr(id: string) {
    try {
      const pub = process.env.NEXT_PUBLIC_APP_URL;
      const eb = pub && !new URL(pub).hostname.includes('localhost') ? pub : window.location.origin;
      const q = await (await fetch(`/api/classroom/${id}/qrcode?host=${encodeURIComponent(eb)}`)).json();
      setQr({ dataUrl: q.dataUrl, joinUrl: q.joinUrl });
    } catch {
      /* noop */
    }
  }
  async function fetchThoughts(id: string) {
    try {
      const r = await (await fetch(`/api/classroom/${id}/thoughts`)).json();
      setThoughts(r?.thoughts ?? []);
    } catch {
      /* noop */
    }
  }

  const total = summary?.totalStudents || 1;

  return (
    <div style={{ background: 'var(--dark)', color: '#e2e8f0', minHeight: '100vh', padding: 40 }}>
      {effectiveHost === 'localhost' && (
        <div style={{ background: 'var(--red)', color: '#fff', padding: '14px 20px', borderRadius: 8, marginBottom: 20, textAlign: 'center', fontSize: 16 }}>
          当前使用 localhost 打开大屏，学生手机扫码后无法访问。
          请从教师端点击「打开大屏（局域网 IP）」重新打开本页。
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{meta?.courseName ? `顷悟 · ${meta.courseName}` : '顷悟 · AI 互动体验课'}</h1>
        <div style={{ fontSize: 18 }}>
          在线 <b style={{ color: 'var(--green)' }}>{summary?.onlineStudents ?? 0}</b> / {summary?.totalStudents ?? 0}
        </div>
      </div>

      {!sessionId ? (
        <p style={{ color: '#94a3b8' }}>请在教师端点击“打开大屏”后访问此页（需带 ?sessionId=）。</p>
      ) : loading ? (
        <div style={{ textAlign: 'center', marginTop: '30vh', color: '#94a3b8' }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>加载中…</div>
          <div style={{ fontSize: 14 }}>正在获取课堂状态</div>
        </div>
      ) : summary?.status === 'closed' ? (
        <div style={{ textAlign: 'center', marginTop: '20vh' }}>
          <div style={{ fontSize: 44, fontWeight: 700 }}>本课堂已关闭</div>
          <div style={{ color: '#94a3b8', marginTop: 12, fontSize: 18 }}>学生已释放，本场已结束。教师开启新课堂后，请重新打开大屏。</div>
        </div>
      ) : !module ? (
        <DanmakuScreen thoughts={thoughts} entered={summary?.totalStudents ?? 0} />
      ) : module.type === 'waiting' ? (
        <DanmakuScreen thoughts={thoughts} entered={summary?.totalStudents ?? 0} />
      ) : module.type === 'hr_screening' ? (
        <A0Screen module={module} screening={screening} summary={summary} locked={summary?.moduleLocked ?? false} subState={summary?.moduleSubState ?? null} />
      ) : (summary?.moduleSubState ?? '').startsWith('page:') ? (
        <ContentPageHost subState={summary?.moduleSubState ?? ''} />
      ) : module.type === 'a0_new' ? (
        <AvatarA0Screen type={module.id} sessionId={sessionId} subState={summary?.moduleSubState ?? null} total={summary?.totalStudents ?? 1} />
      ) : module.type === 'avatar_flow' ? (
        <AvatarA1Screen sessionId={sessionId} subState={summary?.moduleSubState ?? null} />
      ) : module.type === 'site_entry' ? (
        <SiteEntryScreen sessionId={sessionId} subState={summary?.moduleSubState ?? null} />
      ) : module.type === 'world' ? (
        <WorldScreen sessionId={sessionId} />
      ) : module.type === 'closing' ? (
        (() => {
          // 收官模块：按当前环节 subState 渲染对应屏
          const st = String(summary?.moduleSubState ?? '');
          if (st.startsWith('closing:wings')) return <FourWingsScreen subState={st} />;
          if (st.startsWith('closing:price')) return <PriceRevealScreen subState={st} />;
          return <PainWallScreen subState={st} />;
        })()
      ) : module.type === 'grow_game' ? (
        <PlaceholderModule title={module.title} />
      ) : module.type === 'ai_task' ? (
        module.screenContent?.phase === 'redo' ? (
          <A03Screen module={module} analytics={analytics} total={total} summary={summary} startedAt={startedAt} subState={summary?.moduleSubState ?? null} sessionId={sessionId} />
        ) : (
          <A01Screen module={module} analytics={analytics} total={total} summary={summary} startedAt={startedAt} />
        )
      ) : module.type === 'class_mirror' ? (
        <A02Screen module={module} analytics={analytics} total={total} subState={summary?.moduleSubState ?? null} />
      ) : module.type === 'lecture' ? (
        <A03Screen module={module} sessionId={sessionId} subState={summary?.moduleSubState ?? null} />
      ) : module.type === 'l2_intro' ? (
        <L2IntroScreen module={module} />
      ) : module.type === 'knowledge_select' ? (
        <A04Screen summary={summary} total={total} module={module} />
      ) : module.type === 'skill_build' ? (
        <A05Screen summary={summary} total={total} module={module} />
      ) : module.type === 'assistant_try' ? (
        <A06Screen summary={summary} total={total} module={module} />
      ) : module.type === 'wrap_up' ? (
        <A08Screen module={module} />
      ) : (
        <GenericScreen summary={summary} total={total} module={module} />
      )}

      {/* 右上角常驻扫码二维码：所有关卡都显示，学生扫码即入场 */}
      <QrCorner qr={qr} meta={meta} visible={!!sessionId} />
    </div>
  );
}


function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

// 内容页宿主：subState = page:{pageId} 时渲染独立内容页（标题从页面序列拉取）
function ContentPageHost({ subState }: { subState: string }) {
  const pageId = subState.slice('page:'.length);
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!pageId) return;
    let closed = false;
    (async () => {
      for (const g of ['A0', 'A1', 'A2']) {        try {
          const r = await fetch(`/api/pages?group=${g}`);
          const d = await r.json();
          const p = (d.pages ?? []).find((x: any) => x.id === pageId);
          if (p) { if (!closed) setTitle(p.title ?? ''); break; }
        } catch { /* noop */ }
      }
    })();
    return () => { closed = true; };
  }, [pageId]);
  return <ContentPage pageId={pageId} title={title} />;
}

// 待重建模块占位（A2 快速入门网站已清空，重做前显示占位）
function PlaceholderModule({ title }: { title: string }) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, color: '#c4b5fd' }}>{title}</div>
      <div style={{ fontSize: 18, color: 'var(--muted)' }}>本环节待重建，请先不要进入。</div>
    </div>
  );
}

function A01Screen({
  module,
  analytics,
  total,
  summary,
  startedAt,
}: {
  module: ModuleDef;
  analytics: Analytics | null;
  total: number;
  summary: Summary | null;
  startedAt: string | null;
}) {
  const ph = (module.teacherContent?.screenPhase1 ?? {}) as { headline?: string; subline?: string; brief?: string; operationHint?: string };
  const cfg = (module.teacherContent ?? {}) as {
    headline?: string;
    timeLimitSec?: number;
    taskArea?: { targetUser?: string; goal?: string; available?: string; finalDeliverable?: string };
    prompt?: string;
    requirements?: string[];
    materials?: { id: string; title: string; body: string }[];
  };
  const timeLimit = cfg.timeLimitSec ?? 480;
  const locked = summary?.moduleLocked ?? false;
  // 进入 A01 的真实时刻（老师推进到本环节的那一刻）。迟到/二次进入的学生都按此对齐剩余时间。
  const deadline = startedAt ? new Date(startedAt).getTime() + timeLimit * 1000 : null;
  const [remaining, setRemaining] = useState<number>(timeLimit);

  // 大屏演示状态：老师可以直接在 AI 操作区输入并发送，给学生做操作示范
  const [chatInput, setChatInput] = useState('');
  const [finalInput, setFinalInput] = useState('');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [vocabAttached, setVocabAttached] = useState(false);
  const vocabIncludedRef = useRef(false);

  useEffect(() => {
    if (locked) return;
    if (deadline) {
      // 有真实起点：基于截止时刻实时计算剩余，迟到者自动显示正确的剩余时间
      const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }
    // 兼容无起点（旧数据）：本地从满时长倒数
    setRemaining(timeLimit);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [deadline, locked, timeLimit]);

  const showAnalytics = locked || remaining === 0;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleDemoSend = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    const attachVocab = vocabAttached && !vocabIncludedRef.current;
    const effective = attachVocab ? `【已附加资料：四级核心词汇 400 词】\n${vocabText()}\n\n${text}` : text;
    if (attachVocab) vocabIncludedRef.current = true;
    const next: ChatTurn[] = [...chatTurns, { role: 'user', content: effective }];
    setChatTurns(next);
    setChatInput('');
    setSending(true);
    try {
      const res = await fetch('/api/screen/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatTurns([...next, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setChatTurns([...next, { role: 'assistant', content: '（演示：AI 调用失败，请检查网络或 LLM 配置）' }]);
    } finally {
      setSending(false);
    }
  };

  // 任务进行中：大屏 1:1 同步展示学生端 AI 工作区，方便老师指着讲解操作步骤
  if (!showAnalytics) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 46, fontWeight: 800 }}>{module.screenContent?.headline ?? cfg.headline ?? 'AI 实战挑战'}</div>
            <div style={{ fontSize: 20, color: '#cbd5e1', marginTop: 6 }}>{module.screenContent?.subline ?? ph.subline}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--yellow)' }}>{fmt(remaining)}</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>剩余时间</div>
          </div>
        </div>
        <p style={{ color: '#94a3b8', maxWidth: 1100, fontSize: 17, marginBottom: 28 }}>{ph.brief}</p>

        {/* 与学生端同款的 AI 工作区，大屏仅作展示，按钮禁用 */}
        <div className="ai-workspace">
          <div className="zone task-zone">
            <h3>任务区</h3>
            <p className="task-prompt">{cfg.prompt}</p>
            {ph.operationHint && (
              <div className="task-hint" style={{ marginTop: 10, color: '#bae6fd', fontSize: 14, lineHeight: 1.6 }}>{ph.operationHint}</div>
            )}
          </div>

          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#16233a', border: '1px solid #2b3650', borderRadius: 10,
              padding: '12px 16px', marginTop: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>四级核心词汇</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                更多核心词还没有记住（400 词 · 10 天 × 40 词）
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="mini-btn primary" onClick={() => setShowVocab(true)}>点击查看</button>
              {!vocabAttached && (
                <button type="button" className="mini-btn primary" onClick={() => { setVocabAttached(true); }}>
                  把词库发给 AI
                </button>
              )}
            </div>
          </div>

          <div className="zone ai-zone">
            <h3>AI 操作区（大屏演示）</h3>
            <div className="chat-log">
              {vocabAttached && (
                <div className="bubble system" style={{ opacity: 0.9 }}>
                  📎 已附加：四级核心词汇（400 词）——将随你的消息一起发送给 AI
                </div>
              )}
              {chatTurns.length === 0 ? (
                <p className="hint">按你平时真实使用 AI 的方式开始。可以先定义问题、再给资料、再设计、再检查依据。</p>
              ) : (
                chatTurns.map((t, i) => (
                  <div key={i} className={`bubble ${t.role}`}>
                    {t.content}
                  </div>
                ))
              )}
              {sending && <div className="bubble assistant">AI 思考中…</div>}
            </div>
            <div className="row">
              <textarea
                placeholder="向 AI 说明你的任务…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDemoSend(); } }}
              />
              <button className="secondary" onClick={handleDemoSend} disabled={sending || !chatInput.trim()}>
                {sending ? '发送中…' : '发送'}
              </button>
            </div>
            <div className="submit-area" style={{ textAlign: 'center', padding: '12px 0' }}>
              <button onClick={() => setDemoSubmitted(true)} disabled={demoSubmitted} className="primary" style={{ fontSize: 15, padding: '10px 32px', borderRadius: 8 }}>
                {demoSubmitted ? '已提交（演示）' : '提交最终成果'}
              </button>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>AI 将根据对话过程自动判断并给出结论</p>
            </div>
          </div>
        </div>

        <p style={{ color: '#64748b', fontSize: 14, marginTop: 24 }}>任务进行中，学生端同步执行；大屏暂不打分、不展示正确做法，避免影响后续同学。</p>
        <VocabBrowser open={showVocab} onClose={() => setShowVocab(false)} onSendToAI={() => { setVocabAttached(true); setShowVocab(false); }} />
      </>
    );
  }

  // 倒计时结束或被锁定后：展示全班统计数据，用于复盘讲解
  const m = analytics?.metrics;
  const stepwise = analytics?.aiStyle.find((x) => x.label.includes('分步'))?.pct ?? 0;
  const stats = [
    { label: '已进入', value: m?.entered ?? 0 },
    { label: '已开始', value: m?.firstCall ?? 0 },
    { label: '已调用 AI', value: m?.firstCall ?? 0 },
    { label: '已提交', value: m?.submitted ?? 0 },
  ];
  const neutral = [
    { label: '使用给定资料', value: pct(m?.usedMaterial ?? 0, total) },
    { label: '进行二次对话', value: pct(m?.iterated ?? 0, total) },
    { label: '主动检查依据', value: pct(m?.verified ?? 0, total) },
    { label: '形成分步流程', value: stepwise },
  ];
  return (
    <>
      <div style={{ fontSize: 46, fontWeight: 800, marginBottom: 10 }}>{module.screenContent?.headline ?? cfg.headline ?? 'AI 实战挑战'}</div>
      <div style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 8 }}>{module.screenContent?.subline ?? ph.subline}</div>
      <p style={{ color: '#94a3b8', maxWidth: 900, fontSize: 16 }}>{ph.brief}</p>
      <div style={{ display: 'flex', gap: 28, marginTop: 28, flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--green)' }}>{s.value}</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 32, color: '#94a3b8' }}>当前全班使用方式（中性状态）</h3>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        {neutral.map((s) => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{s.value}%</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <p style={{ color: '#64748b', marginTop: 28, fontSize: 14 }}>任务已结束，结合全班数据讲解为什么同一个 AI 会给出不同结果。</p>
      <VocabBrowser open={showVocab} onClose={() => setShowVocab(false)} onSendToAI={() => { setVocabAttached(true); setShowVocab(false); }} />
    </>
  );
}

function A02Screen({ module, analytics, total, subState }: { module: ModuleDef; analytics: Analytics | null; total: number; subState: string | null }) {
  const cfg = (module.teacherContent ?? {}) as {
    headline?: string;
    question?: string;
    behaviors?: { key: string; label: string }[];
    paths?: { key: string; name: string; flow: string; note: string }[];
    artifactsTitle?: string;
    fourElements?: { name: string; icon: string; q: string; bad: string; good: string }[];
    scripts?: { elem: string; icon: string; what: string; say: string }[];
    nextCue?: string;
  };
  // 大屏翻页由教师端控制（moduleSubState = mirror:1/2/3），大屏自身不再有翻页按钮
  const slide = Math.min(3, Math.max(1, parseInt(subState?.replace('mirror:', '') ?? '1', 10) || 1));
  const m = analytics?.metrics;
  const behaviors = cfg.behaviors ?? [];
  const rateOf = (key: string): number => {
    if (key === 'context') return analytics?.dimensions?.find((d) => d.key === 'context')?.pct ?? 0;
    if (key === 'verified') return analytics?.dimensions?.find((d) => d.key === 'verify')?.pct ?? 0;
    if (key === 'process') return analytics?.dimensions?.find((d) => d.key === 'process')?.pct ?? 0;
    if (key === 'modified') return pct(m?.modified ?? 0, total);
    return 0;
  };
  const pathList = (cfg.paths ?? []).map((p) => ({
    ...p,
    pct: analytics?.pathDistribution?.find((x) => x.key === p.key)?.pct ?? 0,
    count: analytics?.pathDistribution?.find((x) => x.key === p.key)?.count ?? 0,
  }));
  const elemColors = ['var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--purple)'];

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* 第1屏：全班行为镜像 */}
      {slide === 1 && (
        <>
          <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 6 }}>{cfg.headline ?? '刚才，全班是怎样使用 AI 的？'}</div>
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 18 }}>同一个任务、同一个 AI，大家采取的方式却不同。</p>

          <h3 style={{ color: '#94a3b8', marginBottom: 12 }}>全班真实行为</h3>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
            {behaviors.map((b) => (
              <div key={b.key} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16, minWidth: 180, textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--blue)' }}>{rateOf(b.key)}%</div>
                <div style={{ color: '#cbd5e1', fontSize: 15, marginTop: 6 }}>{b.label}</div>
              </div>
            ))}
          </div>

          <h3 style={{ color: '#94a3b8', marginBottom: 12 }}>三种使用路径</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {pathList.map((p) => (
              <div key={p.key} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--yellow)' }}>{p.name}</div>
                <div style={{ fontSize: 14, color: '#cbd5e1', marginBottom: 10 }}>{p.flow}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>{p.note}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{p.pct}%</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.count} 名学员</div>
              </div>
            ))}
          </div>

          <h3 style={{ color: '#94a3b8', marginTop: 26, marginBottom: 12 }}>{cfg.artifactsTitle ?? '全班做出了什么'}</h3>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {(analytics?.artifactDistribution ?? []).map((a) => (
              <div key={a.key} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, minWidth: 150, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{a.pct}%</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>{a.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 26, padding: 16, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12 }}>
            <div style={{ color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>本班发现</div>
            <p style={{ margin: 0, fontSize: 18 }}>{analytics?.classInsight ?? '提交仍在统计中，稍后生成本班发现。'}</p>
          </div>

          <p style={{ fontSize: 22, marginTop: 30, color: 'var(--green)', fontWeight: 700 }}>{cfg.question}</p>
        </>
      )}

      {/* 第2屏：四个要素（图形化） */}
      {slide === 2 && (
        <>
          <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 6 }}>结果不同的关键，在这四个要素</div>
          <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 24 }}>同样是和 AI 对话，做对这四步的人，结果质量明显更高。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
            {(cfg.fourElements ?? []).map((e, i) => {
              const c = elemColors[i % 4];
              return (
                <div key={e.name} style={{ background: '#1e293b', border: '1px solid #334155', borderTop: `4px solid ${c}`, borderRadius: 16, padding: '24px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>{e.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: c, marginBottom: 8 }}>{e.name}</div>
                  <div style={{ fontSize: 15, color: '#cbd5e1', marginBottom: 14, lineHeight: 1.5 }}>{e.q}</div>
                  <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, marginBottom: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', lineHeight: 1.4 }}>✗ {e.bad}</div>
                  <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', lineHeight: 1.4 }}>✓ {e.good}</div>
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', fontSize: 22, marginTop: 30, color: 'var(--green)', fontWeight: 700 }}>那这四步，具体要怎么和 AI 说？</p>
        </>
      )}

      {/* 第3屏：话术范本 */}
      {slide === 3 && (
        <>
          <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 6 }}>针对四个要素，你可以这么说</div>
          <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 24 }}>把每个要素变成一句明确的话，AI 才知道你要什么。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {(cfg.scripts ?? []).map((s, i) => {
              const c = elemColors[i % 4];
              return (
                <div key={s.elem} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 36 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{s.elem}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{s.what}</div>
                  </div>
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderLeft: '4px solid var(--green)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>✓ 你可以这么说</div>
                    <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2e8f0' }}>{s.say}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 28, textAlign: 'center', padding: 18, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12 }}>
            <div style={{ color: 'var(--purple)', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{(cfg.nextCue ?? '').split('：')[0] || '接下来'}</div>
            <div style={{ fontSize: 15, color: '#cbd5e1' }}>{(cfg.nextCue ?? '').split('：').slice(1).join('：')}</div>
          </div>
        </>
      )}
    </div>
  );
}

function A03Screen({ module, analytics, total, summary, startedAt, subState, sessionId }: any) {
  const cfg = (module.teacherContent ?? {}) as { headline?: string; subline?: string; brief?: string };
  const [baseline, setBaseline] = useState<any>(null);
  const timeLimit = (module as any).durationSeconds ?? 180;
  const target = startedAt ? new Date(startedAt).getTime() + timeLimit * 1000 : null;
  const remain = useCountdown(target);

  useEffect(() => {
    if (subState === 'compare' && sessionId) {
      fetch(`/api/analytics?sessionId=${sessionId}&moduleId=A01_BASELINE`).then((r) => r.json()).then(setBaseline).catch(() => {});
    }
  }, [subState, sessionId]);

  const submitted = summary?.overview?.find((o: any) => o.moduleId === module.id)?.completed ?? 0;

  // compare 视图（所有 hooks 已在上面调用完毕）
  if (subState === 'compare') {
    if (!analytics || !baseline) {
      return (
        <>
          <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 20 }}>正在加载对比数据…</div>
          <p style={{ color: '#94a3b8' }}>如果尚无学生提交第二轮成果，请等待提交后再揭晓。</p>
        </>
      );
    }
    try {
      const cmp = compareRounds(baseline, analytics);
    return (
      <>
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 20 }}>没有更换 AI，改变任务设计和使用过程后，发生了什么？</div>
        <h3 style={{ color: '#94a3b8' }}>四个要素的前后变化</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
          {cmp.dimensions.map((d) => (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ width: 200, color: '#cbd5e1' }}>{d.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{d.before}%</div>
              <div style={{ color: 'var(--green)', fontSize: 22 }}>→</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{d.after}%</div>
              {d.delta > 0 && <span style={{ color: 'var(--green)', fontSize: 13 }}>(+{d.delta})</span>}
            </div>
          ))}
        </div>
        <h3 style={{ color: '#94a3b8' }}>使用路径的变化</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 26 }}>
          {(['direct', 'iterate', 'workflow'] as const).map((k) => (
            <div key={k} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{cmp.pathBefore[k]}% → {cmp.pathAfter[k]}%</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{analytics.pathDistribution?.find((p: any) => p.key === k)?.label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 20, color: 'var(--green)', fontWeight: 700 }}>真正拉开结果差异的，不是使用了哪个 AI，而是能否定义问题、设计过程并检查结果。</p>
      </>
    );
  } catch (e) {
    return (
      <>
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 20 }}>对比数据加载失败</div>
        <p style={{ color: '#94a3b8' }}>可能尚无足够的提交数据。请确认学生已提交第一轮和第二轮成果后再试。</p>
      </>
    );
  }
  }

  // 正常视图（第二轮进行中）
  return (
    <>
      <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 8 }}>{cfg.headline ?? '第二轮：重新设计同一个任务'}</div>
      <div style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 8 }}>{cfg.subline}</div>
      <p style={{ color: '#94a3b8', maxWidth: 900, fontSize: 16 }}>{cfg.brief}</p>
      <div style={{ display: 'flex', gap: 28, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--yellow)' }}>{fmtCountdown(remain)}</div>
        <div>
          <div style={{ fontSize: 22 }}>已完成 {submitted} / {total}</div>
          <div style={{ height: 14, width: 360, background: 'rgba(255,255,255,0.1)', borderRadius: 7, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${total ? Math.round((submitted / total) * 100) : 0}%`, height: '100%', background: 'var(--blue)' }} />
          </div>
        </div>
      </div>
      <p style={{ color: '#64748b', marginTop: 24, fontSize: 14 }}>学生端正在按“对象—任务—过程—检验”重新设计同一个任务，原始内容不公开姓名。</p>
    </>
  );
}

const RATING_COLOR: Record<string, string> = {
  高: '#22c55e',
  中: '#eab308',
  低: '#ef4444',
  未知: '#64748b',
};
const SCREEN_BTN = {
  padding: '8px 18px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 15,
};

function moduleProgress(summary: Summary | null, module: ModuleDef) {
  const stat = summary?.overview?.find((o: any) => o.moduleId === module.id);
  return { done: stat?.completed ?? 0, inProgress: stat?.inProgress ?? 0, stuck: stat?.stuck ?? 0 };
}

function L2Progress({ summary, total, module }: { summary: Summary | null; total: number; module: ModuleDef }) {
  const { done } = moduleProgress(summary, module);
  if (!total) return null;
  return (
    <div style={{ marginTop: 22, maxWidth: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span>{module.title} · 完成</span>
        <span style={{ color: '#94a3b8' }}>
          {done} / {total}
        </span>
      </div>
      <div style={{ height: 16, borderRadius: 8, overflow: 'hidden', background: '#1e293b' }}>
        <div style={{ width: `${Math.round((done / total) * 100)}%`, background: 'var(--green)', height: '100%' }} />
      </div>
    </div>
  );
}

// 第二关开场（L2_INTRO）：大屏展示第一关→第二关的关系、两位使用者与流程
function L2IntroScreen({ module }: { module: ModuleDef }) {
  const [slide, setSlide] = useState(1);
  const sc: any = module.screenContent ?? {};
  const tc: any = module.teacherContent ?? {};
  const personas: any[] = sc.personas ?? [];
  const d1 = tc.difficulty1;

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* 阶段1：开场 + 两位使用者人物卡 */}
      {slide === 1 && (
        <>
          <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 8 }}>{sc.headline ?? module.title}</div>
          <div style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 20 }}>{sc.subline}</div>
          {sc.firstLevel && (
            <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 14, marginBottom: 18, background: '#0f172a', maxWidth: 620 }}>
              <div style={{ fontWeight: 700, color: '#94a3b8' }}>{sc.firstLevel.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 6, fontSize: 16 }}>{sc.firstLevel.desc}</div>
            </div>
          )}
          <h3 style={{ color: '#94a3b8', marginBottom: 12 }}>两位使用者</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 860 }}>
            {personas.map((p) => (
              <div key={p.id} style={{ border: '1px solid #334155', borderRadius: 12, padding: 16, background: '#1e293b' }}>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{p.name}（基础{p.base}）</div>
                <div style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                  <div><b style={{ color: '#94a3b8' }}>主要问题：</b>{p.mainProblem}</div>
                  <div><b style={{ color: '#94a3b8' }}>薄弱题型：</b>{p.weakType}</div>
                  <div><b style={{ color: '#94a3b8' }}>可用时间：</b>{p.availableTime}</div>
                  <div><b style={{ color: '#94a3b8' }}>目标：</b>{p.goal}</div>
                  <div><b style={{ color: '#94a3b8' }}>偏好：</b>{p.preference}</div>
                </div>
              </div>
            ))}
          </div>
          {/* 引导问句：把两张人物卡串成悬念，过渡到屏2 */}
          <div style={{ fontSize: 26, color: 'var(--green)', fontWeight: 700, margin: '24px 0 0', maxWidth: 860, lineHeight: 1.5 }}>
            他们的情况不同，同一个助手怎样分别帮助他们？
          </div>
        </>
      )}

      {/* 阶段2：困难1 → 引出对训练依据的需求 */}
      {slide === 2 && d1 && (
        <>
          <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 6 }}>{d1.headline}</div>
          <div style={{ fontSize: 18, color: '#94a3b8', marginBottom: 22 }}>{d1.subline}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 900 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 700, color: 'var(--orange)', marginBottom: 10, fontSize: 17 }}>📖 小林</div>
              <div style={{ fontSize: 15, color: '#cbd5e1', marginBottom: 12, lineHeight: 1.6 }}>{d1.lin.problem}</div>
              <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#bae6fd', lineHeight: 1.5, marginBottom: 6 }}>📚 语料：{d1.lin.corpus}</div>
              <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fde68a', lineHeight: 1.5 }}>📋 方法：{d1.lin.method}</div>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 10, fontSize: 17 }}>📚 小周</div>
              <div style={{ fontSize: 15, color: '#cbd5e1', marginBottom: 12, lineHeight: 1.6 }}>{d1.zhou.problem}</div>
              <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#bae6fd', lineHeight: 1.5, marginBottom: 6 }}>📚 语料：{d1.zhou.corpus}</div>
              <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fde68a', lineHeight: 1.5 }}>📋 方法：{d1.zhou.method}</div>
            </div>
          </div>
          <div style={{ marginTop: 26, padding: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 14, textAlign: 'center', maxWidth: 900 }}>
            <div style={{ fontSize: 16, color: '#cbd5e1', marginBottom: 10, lineHeight: 1.6 }}>{d1.conclusion}</div>
            <div style={{ fontSize: 26, color: 'var(--green)', fontWeight: 800 }}>↓</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', marginTop: 6 }}>{d1.solution}</div>
            <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 14 }}>{d1.solutionSub}</div>
          </div>
        </>
      )}

      {/* 翻页控制 */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', gap: 10, alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: 30, padding: '8px 14px', zIndex: 100 }}>
        <button onClick={() => setSlide(Math.max(1, slide - 1))} style={{ background: '#334155', color: '#e2e8f0', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>‹</button>
        <span style={{ fontSize: 14, color: '#94a3b8', minWidth: 50, textAlign: 'center' }}>{slide} / 2</span>
        <button onClick={() => setSlide(Math.min(2, slide + 1))} style={{ background: '#334155', color: '#e2e8f0', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>›</button>
      </div>
    </div>
  );
}

function A04Screen({ summary, total, module }: { summary: Summary | null; total: number; module: ModuleDef }) {
  return (
    <div>
      <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 8 }}>{module.screenContent?.headline ?? module.title}</div>
      {module.screenContent?.subline ? (
        <div style={{ color: '#94a3b8', marginBottom: 24, fontSize: 18 }}>{module.screenContent.subline}</div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 14,
        }}
      >
        {KNOWLEDGE_DOCS.map((d) => (
          <div key={d.id} style={{ border: '1px solid #334155', borderRadius: 10, padding: 14, background: '#0f172a' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{d.title}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
              来源：{d.source} · 更新：{d.updatedAt}
            </div>
            <div style={{ fontSize: 13, marginTop: 8, color: '#cbd5e1' }}>{d.summary}</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              相关性 <span style={{ color: RATING_COLOR[d.relevance] }}>{d.relevance}</span> · 可靠性{' '}
              <span style={{ color: RATING_COLOR[d.reliability] }}>{d.reliability}</span> · 时效性{' '}
              <span style={{ color: RATING_COLOR[d.timeliness] }}>{d.timeliness}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>推荐类别：{d.recommendedClass}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, color: '#cbd5e1' }}>
        每名学生从 8 份资料中选择 4 份，建立自己的核心知识库（标准：相关性 / 可靠性 / 时效性）。
      </div>
      <L2Progress summary={summary} total={total} module={module} />
    </div>
  );
}

function A05Screen({ summary, total, module }: { summary: Summary | null; total: number; module: ModuleDef }) {
  return (
    <div>
      <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 8 }}>{module.screenContent?.headline ?? module.title}</div>
      {module.screenContent?.subline ? (
        <div style={{ color: '#94a3b8', marginBottom: 24, fontSize: 18 }}>{module.screenContent.subline}</div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {SKILL_BLOCKS.map((b) => (
          <div key={b.key} style={{ border: '1px solid #334155', borderRadius: 10, padding: 16, background: '#0f172a' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{b.title}</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>参考句：{b.fixedSentence}</div>
            <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6 }}>关键词：{b.keywords?.join('、')}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>至少 {b.minLength} 字</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, color: '#cbd5e1' }}>
        知识使用规则：当不同资料说法冲突时，优先相信来源更可靠、时效更新的那一类。
      </div>
      <L2Progress summary={summary} total={total} module={module} />
    </div>
  );
}

function renderBigScreen(s: any) {
  return (
    <div style={{ fontSize: 18, lineHeight: 1.9 }}>
      {s.coreQuestion ? (
        <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 12 }}>核心问题：{s.coreQuestion}</div>
      ) : null}
      {(s.blocks ?? []).map((b: string, i: number) => (
        <div key={`b${i}`} style={{ marginBottom: 6 }}>· {b}</div>
      ))}
      {(s.framework ?? []).map((f: string, i: number) => (
        <div key={`f${i}`} style={{ marginBottom: 6 }}>· {f}</div>
      ))}
      {(s.observe ?? []).map((o: string, i: number) => (
        <div key={`o${i}`} style={{ marginBottom: 6 }}>· {o}</div>
      ))}
      {(s.problems ?? []).map((p: string, i: number) => (
        <div key={`p${i}`} style={{ marginBottom: 6 }}>· {p}</div>
      ))}
      {s.flow?.length ? (
        <div style={{ color: '#38bdf8', margin: '12px 0' }}>{s.flow.join('  →  ')}</div>
      ) : null}
      {s.task ? <div style={{ margin: '10px 0', color: '#cbd5e1' }}>{s.task}</div> : null}
      {s.diagram ? <div style={{ margin: '10px 0', color: '#cbd5e1' }}>{s.diagram}</div> : null}
      {s.note ? <div style={{ color: '#94a3b8', fontSize: 15, marginTop: 8 }}>{s.note}</div> : null}
      {s.emphasis ? <div style={{ color: '#fbbf24', marginTop: 8 }}>{s.emphasis}</div> : null}
      {(s.personas ?? []).map((p: any, i: number) => (
        <div key={`pe${i}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: 10, margin: '8px 0' }}>
          <b>{p.name}</b>：{p.base}；主要问题：{p.mainProblem}；薄弱题型：{p.weakType}；可用时间：{p.availableTime}；目标：{p.goal}
        </div>
      ))}
      {(s.cards ?? []).map((c: any, i: number) => (
        <div key={`c${i}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: 10, margin: '8px 0' }}>
          <div style={{ fontWeight: 700 }}>{c.title}</div>
          {(c.lines ?? []).map((l: string, j: number) => (
            <div key={j} style={{ fontSize: 15, color: '#cbd5e1' }}>· {l}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function A06Screen({ summary, total, module }: { summary: Summary | null; total: number; module: ModuleDef }) {
  // 三屏结构（参考 _a06_demo.html 大屏 3~5）：全班复盘 → 教师点评+引出 → 休息
  // 纯老师手动导航，不自动翻页
  const [idx, setIdx] = useState(0);
  const SCREENS = [
    { key: 'review', title: '全班复盘：第二关小结' },
    { key: 'comment', title: '教师点评' },
    { key: 'break', title: '休息一下' },
  ];
  const current = SCREENS[idx];

  return (
    <div>
      {/* 标题 */}
      <div style={{ fontSize: 38, fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>{current.title}</div>

      {/* ====== 屏1：全班复盘 ====== */}
      {current.key === 'review' && (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* 三列小结 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', marginBottom: 10 }}>✓ 做对了什么</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', lineHeight: 2 }}>
                <li>大部分同学选了核心资料</li>
                <li>Skill 结构完整（4 个区块）</li>
                <li>两位学员结果有差异</li>
                <li>知识库引用了选中资料</li>
              </ul>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginBottom: 10 }}>✗ 没做什么 / 哪里不对</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', lineHeight: 2 }}>
                <li>部分 Skill 写得太笼统</li>
                <li>个别同学选了偏弱资料</li>
                <li>反馈缺少具体证据</li>
                <li>两位学员差异不够明显</li>
              </ul>
            </div>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginBottom: 10 }}>🔧 建议怎么改</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', lineHeight: 2 }}>
                <li>判断规则要写清「如果…就…」</li>
                <li>执行步骤要具体到题型和难度</li>
                <li>反馈要引用资料原文作为证据</li>
                <li>移除来源不明的资料</li>
              </ul>
            </div>
          </div>

          {/* 学生逐人 Skill 评价（示例数据，后续接真实全班接口） */}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#38bdf8', marginBottom: 14 }}>👥 各位同学的 Skill 检查</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {[{
              name: '学生 001',
              blocks: [
                { label: '了解', status: 'good', note: '收集了基础信息' },
                { label: '判断', status: 'weak', note: '规则不够具体' },
                { label: '执行', status: 'good', note: '安排了训练任务' },
                { label: '反馈', status: 'empty', note: '未填写' },
              ],
            }, {
              name: '学生 003',
              blocks: [
                { label: '了解', status: 'good', note: '信息全面' },
                { label: '判断', status: 'good', note: '区分了两人情况' },
                { label: '执行', status: 'good', note: '任务具体可操作' },
                { label: '反馈', status: 'good', note: '有证据支撑' },
              ],
            }, {
              name: '学生 004',
              blocks: [
                { label: '了解', status: 'empty', note: '' },
                { label: '判断', status: 'empty', note: '' },
                { label: '执行', status: 'empty', note: '' },
                { label: '反馈', status: 'empty', note: '' },
              ],
            }].map((stu) => (
              <div key={stu.name} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{stu.name}</div>
                {stu.blocks.map((b) => (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 56, fontSize: 12, fontWeight: 700,
                      color: b.status === 'good' ? '#22c55e' : b.status === 'weak' ? '#fbbf24' : '#ef4444',
                    }}>{b.status === 'good' ? '✓ 合格' : b.status === 'weak' ? '⚠ 偏弱' : '✗ 空'}</span>
                    <span style={{ width: 40, color: 'var(--muted)', fontSize: 13 }}>{b.label}</span>
                    <div style={{ flex: 1, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: b.status === 'good' ? '100%' : b.status === 'weak' ? '50%' : '8%',
                        height: '100%', borderRadius: 4,
                        background: b.status === 'good' ? '#22c55e' : b.status === 'weak' ? '#fbbf24' : '#ef4444',
                        transition: 'width .6s ease',
                      }} />
                    </div>
                    {b.note && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{b.note}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====== 屏2：教师点评 + 引出下一阶段 ====== */}
      {current.key === 'comment' && (
        <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fbbf24', marginBottom: 24 }}>
            🎯 第二关核心收获
          </div>
          <div style={{ fontSize: 19, color: '#cbd5e1', lineHeight: 2.2, marginBottom: 36, textAlign: 'left', background: 'rgba(56,189,248,0.05)', borderRadius: 12, padding: '24px 32px', border: '1px solid rgba(56,189,248,0.15)' }}>
            通过刚才的测试，大家应该感受到了：<br /><br />
            设计 AI 助手不是「随便填填」——<br />
            你的 <strong style={{ color: '#38bdf8' }}>Skill 越具体</strong>，AI 的输出就越有针对性；<br />
            你选的 <strong style={{ color: '#38bdf8' }}>知识库越可靠</strong>，AI 的建议就越有依据。<br /><br />
            这就是<strong style={{ color: '#fbbf24' }}>提示词工程</strong>的核心：<br />
            用明确的指令 + 可靠的知识 = 值得信任的 AI 助手。
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: '#a855f7', marginBottom: 16 }}>📌 记住这三条规则</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 36 }}>
            {[
              { icon: '🎓', rule: '让 AI 当老师', desc: '先告诉它你是谁、你的目标是什么' },
              { icon: '🔍', rule: '用证据说话', desc: '每条建议都要能追溯到某份资料' },
              { icon: '📚', rule: '用可靠资料', desc: '优先选择权威来源、近期更新的内容' },
            ].map((r) => (
              <div key={r.rule} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{r.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 6 }}>{r.rule}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: 30, fontWeight: 800,
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 12,
          }}>
            ☕ 休息一下，回来更精彩
          </div>
          <div style={{ color: '#94a3b8', fontSize: 16 }}>接下来我们将进入最终关卡——用你设计的 AI 助手解决真实问题。</div>
        </div>
      )}

      {/* ====== 屏3：休息 ====== */}
      {current.key === 'break' && (
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>☕</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>休息一下</div>
          <div style={{ fontSize: 18, color: '#94a3b8', lineHeight: 2, marginBottom: 32 }}>
            第二关已经完成<br />
            大家辛苦了！<br />
            放松几分钟<br />
            我们马上进入最终挑战
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 24px', borderRadius: 999,
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
            color: '#c084fc', fontSize: 15,
          }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: '#a855f7', animation: 'pulse 1.5s infinite',
            }} />
            等待进入下一关…
          </div>
        </div>
      )}

      {/* 导航栏 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 36, alignItems: 'center' }}>
        <button style={SCREEN_BTN} onClick={() => setIdx((i) => (i - 1 + SCREENS.length) % SCREENS.length)}>
          ◀ 上一屏
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {SCREENS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setIdx(i)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: i === idx ? 'var(--blue)' : '#1e293b',
                color: i === idx ? '#fff' : '#94a3b8',
              }}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>
        <button style={SCREEN_BTN} onClick={() => setIdx((i) => (i + 1) % SCREENS.length)}>
          下一屏 ▶
        </button>
      </div>

      <L2Progress summary={summary} total={total} module={module} />
    </div>
  );
}

function GenericScreen({ summary, total, module }: { summary: Summary | null; total: number; module: ModuleDef }) {
  return (
    <>
      <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 8 }}>{module.title}</div>
      <div style={{ color: '#94a3b8', marginBottom: 32 }}>
        当前环节：{summary?.currentModuleId ?? '—'} · 状态：{summary?.status}
      </div>
      <h3>全班进度</h3>
      {(summary?.overview ?? []).map((o) => {
        const w = (n: number) => `${Math.round((n / total) * 100)}%`;
        return (
          <div key={o.moduleId} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{o.title}</span>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>
                完成 {o.completed} · 进行 {o.inProgress} · 卡住 {o.stuck}
              </span>
            </div>
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: '#1e293b' }}>
              <div style={{ width: w(o.completed), background: 'var(--green)' }} />
              <div style={{ width: w(o.inProgress), background: 'var(--blue)' }} />
              <div style={{ width: w(o.stuck), background: 'var(--red)' }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function A08Screen({ module }: { module: ModuleDef }) {
  const [slide, setSlide] = useState(0);
  const slides = (module.screenContent?.slides ?? []) as Array<{ h: string; p: string; isQuestion?: boolean }>;
  if (slides.length === 0) {
    return <p style={{ color: '#94a3b8' }}>内容未配置</p>;
  }
  const s = slides[slide];
  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 20, color: '#94a3b8', marginBottom: 16, letterSpacing: 2 }}>一期收尾</div>
      <div style={{ fontSize: 56, fontWeight: 800, marginBottom: 20, lineHeight: 1.15 }}>{s.h}</div>
      <p style={{ color: '#cbd5e1', fontSize: 22, lineHeight: 1.7, maxWidth: 900, marginBottom: 24 }}>{s.p}</p>
      {s.isQuestion && (
        <div style={{ fontSize: 96, color: 'var(--yellow)', fontWeight: 800, marginTop: 8 }}>？</div>
      )}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', gap: 10, alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: 30, padding: '8px 14px', zIndex: 100 }}>
        <button onClick={() => setSlide(Math.max(0, slide - 1))} style={{ background: '#334155', color: '#e2e8f0', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>‹</button>
        <span style={{ fontSize: 14, color: '#94a3b8', minWidth: 50, textAlign: 'center' }}>{slide + 1} / {slides.length}</span>
        <button onClick={() => setSlide(Math.min(slides.length - 1, slide + 1))} style={{ background: '#334155', color: '#e2e8f0', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>›</button>
      </div>
    </div>
  );
}

function useCountdown(target: number | null) {
  const [sec, setSec] = useState<number | null>(
    target ? Math.max(0, Math.round((target - Date.now()) / 1000)) : null
  );
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => {
      setSec(Math.max(0, Math.round((target - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [target]);
  return sec;
}

function fmtCountdown(sec: number | null) {
  if (sec === null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 开场故事：教师端翻页（moduleSubState = story:N），大屏纯展示图文
function StoryScreen({
  module,
  subState,
  summary,
}: {
  module: ModuleDef;
  subState: string;
  summary: Summary | null;
}) {
  const steps = ((module.screenContent?.storySteps ?? []) as Array<{ id: string; image?: string; caption?: string }>);
  const idx = Math.max(0, parseInt(subState.replace('story:', ''), 10) - 1);
  const step = steps[idx] ?? steps[0];
  const isPlaceholder = !step?.image || step.image === '__PLACEHOLDER__';
  return (
    <div className="story-screen">
      <div className="story-image">
        {isPlaceholder ? (
          <div className="story-ph" style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>{idx === 0 ? '🕰️' : '🌐'}</div>
            <div style={{ fontSize: 26, color: '#94a3b8', letterSpacing: 3 }}>{step?.caption ?? `第 ${idx + 1} 页`}</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 10 }}>占位图 · 待替换为真实图片</div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt={step.caption ?? ''} style={{ width: 'min(94vw, 1600px)', maxHeight: '80vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} />
        )}
      </div>
      <div className="story-foot">
        <span>{summary?.totalStudents ?? 0} 人已入场</span>
      </div>
    </div>
  );
}

function A0Screen({
  module,
  screening,
  summary,
  locked,
  subState,
}: {
  module: ModuleDef;
  screening: ScreeningData | null;
  summary: Summary | null;
  locked: boolean;
  subState: string | null;
}) {
  // 开场故事态：大屏只展示图文（无按钮），教师端翻页
  if (typeof subState === 'string' && subState.startsWith('story')) {
    return <StoryScreen module={module} subState={subState} summary={summary} />;
  }
  if (locked) return <A0Reveal screening={screening} summary={summary} />;
  return <A0Live module={module} screening={screening} summary={summary} />;
}

// 状态一 + 状态二：AI 标签现场（进行中）
function A0Live({
  module,
  screening,
  summary,
}: {
  module: ModuleDef;
  screening: ScreeningData | null;
  summary: Summary | null;
}) {
  const total = summary?.totalStudents || 0;
  const submitted = screening?.submitted ?? 0;
  const prompt =
    ((module as any).studentTask?.prompt as string | undefined) ||
    '你说自己会使用AI。能用一个真实例子证明吗？';

  // 现场状态文字（不滚动真实答案，不显示倒计时，由老师手动推进下一环节）
  const statusMsgs = ['正在读取回答……', '正在生成追问……', '正在寻找可信证据……', '正在解读每一位同学……'];
  const [sIdx, setSIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSIdx((i) => (i + 1) % statusMsgs.length), 2600);
    return () => clearInterval(t);
  }, []);

  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const rest = prompt.split('。').slice(1).join('。');

  return (
    <div className="a0-live">
      <div className="a0-topbar">
        <div className="a0-tag">AI 标签进行中</div>
      </div>

      <div className="a0-stage">
        <div className="a0-camera">
          <div className="a0-avatar">
            <div className="a0-scanline" />
            <div className="a0-ring" />
            <div className="a0-wave">
              <i /><i /><i /><i /><i /><i /><i />
            </div>
          </div>
        </div>

        <div className="a0-question">
          {prompt.split('。')[0]}。<br />
          {rest}
        </div>
      </div>

      <div className="a0-foot">
        <div className="a0-status">{statusMsgs[sIdx]}</div>
        <div className="a0-progress">
          <div className="a0-progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="a0-meta">
          <span>已接入 <b>{total}</b> 人</span>
          <span>已完成第一问 <b>{submitted}</b> / {total}</span>
          <span className="a0-anon">回答不会显示姓名</span>
        </div>
      </div>
    </div>
  );
}

// 状态三：全班揭晓（锁定后）
function A0Reveal({
  screening,
  summary,
}: {
  screening: ScreeningData | null;
  summary: Summary | null;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 600);
    return () => clearTimeout(t);
  }, []);

  const submitted = screening?.submitted ?? 0;
  const labels = screening?.labels ?? { tool_user: 0, task_solver: 0, app_creator: 0 };
  const denom = Math.max(submitted, 1);
  const pct = (n: number) => Math.round((n / denom) * 100);
  const samples = screening?.revealSamples ?? [];

  if (!shown) {
    return (
      <div className="a0-reveal-black">
        <div className="a0-reveal-dots">
          <i /><i /><i />
        </div>
      </div>
    );
  }

  return (
    <div className="a0-reveal">
      <div className="a0-reveal-statement">
        我们都说自己会 AI。<br />
        但每个人拿到的标签，并不一样。
      </div>

      <div className="a0-snap">
        <div className="a0-snap-title">本班 AI 标签快照</div>
        <div className="a0-bars">
          {([['tool_user', 'AI 路人', '主要用过一些 AI 工具'], ['task_solver', 'AI 搭子', '能说清解决了什么具体问题'], ['app_creator', 'AI 合伙人', '做出了可以被别人使用、验证或交付的应用']] as const).map(
            ([k, name, desc]) => (
              <div className="a0-bar-row" key={k}>
                <div className="a0-bar-name">
                  {name}
                  <div className="a0-bar-desc">{desc}</div>
                </div>
                <div className="a0-bar-track">
                  <div className={`a0-bar-fill k-${k}`} style={{ width: `${pct(labels[k])}%` }} />
                </div>
                <div className="a0-bar-pct">{labels[k]} 人 · {pct(labels[k])}%</div>
              </div>
            ),
          )}
        </div>
        <div className="a0-snap-note">共 {submitted} 人完成第一问</div>
      </div>

      <div className="a0-samples">
        <div className="a0-samples-title">三条匿名回答 · 我们识别到</div>
        {samples.length === 0 ? (
          <div className="a0-samples-empty">等待提交……</div>
        ) : (
          samples.map((s, i) => (
            <div className="a0-sample" key={i}>
              <div className="a0-sample-answer">“{s.answer}”</div>
              <div className="a0-sample-dims">
                {(['tools', 'task', 'result', 'action'] as const).map((d) => (
                  <span key={d} className={s.dims[d] ? 'a0-dim on' : 'a0-dim'}>
                    {d === 'tools' ? '工具' : d === 'task' ? '任务' : d === 'result' ? '成果' : '行动'}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="a0-teacher-hint">教师追问：两个人都在使用 AI，为什么拿到的标签不一样？</div>

      <div className="a0-next">让标签更有说服力：选择一个真实项目，补充"任务—行动—成果"</div>
    </div>
  );
}

// 开课前暖场页：大屏弹幕流 + 引导语（右上角二维码由全局 QrCorner 常驻提供）
function DanmakuScreen({
  thoughts,
  entered,
}: {
  thoughts: { id: string; text: string; anonymousId: string; createdAt: string }[];
  entered: number;
}) {
  return (
    <div className="dm-screen">
      <div className="dm-head">
        <div className="dm-stats">
          <span>已进入 <b>{entered}</b> 人</span>
          <span>想法 <b>{thoughts.length}</b> 条</span>
        </div>
      </div>

      <div className="dm-guide">
        <div className="dm-guide-h">用一句话，说说你对 AI 的认知</div>
        <div className="dm-guide-s">扫码右上角二维码进入课堂，写下你的想法，它会在这里流淌</div>
      </div>

      <div className="dm-zone">
        {thoughts.length === 0 ? (
          <div className="dm-empty">还没有想法，等第一句来自你 ✨</div>
        ) : (
          thoughts.map((t, i) => (
            <div
              className="dm-bubble"
              key={t.id}
              style={{ animationDelay: `${Math.min(i * 90, 1800)}ms` }}
            >
              {t.text}
            </div>
          ))
        )}
      </div>

      <div className="dm-thanks">谢谢你的想法，它们正在大屏上流动</div>
    </div>
  );
}

// 右上角常驻扫码二维码：所有关卡都显示，学生扫后进入课堂；点击放大，点遮罩收起
function QrCorner({ qr, meta, visible }: { qr: { dataUrl: string; joinUrl: string } | null; meta: { inviteCode: string; courseName: string; createdAt: string | null; scheduledStartAt: string | null } | null; visible: boolean }) {
  const [zoom, setZoom] = useState(false);
  if (!visible) return null;
  return (
    <>
      <button
        onClick={() => setZoom(true)}
        style={{ position: 'fixed', right: 28, top: 84, background: '#0f172a', border: '2px solid var(--blue)', borderRadius: 14, padding: 10, cursor: 'pointer', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', zIndex: 40 }}
        aria-label="扫码进入课堂"
      >
        {qr?.dataUrl ? (
          <img src={qr.dataUrl} alt="扫码进入课堂" width={110} height={110} />
        ) : (
          <div style={{ width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>二维码…</div>
        )}
        <div style={{ color: 'var(--blue)', fontSize: 13, marginTop: 6 }}>扫码进入</div>
      </button>
      {zoom && (
        <div
          onClick={() => setZoom(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, cursor: 'pointer' }}
        >
          <div style={{ background: '#fff', padding: 20, borderRadius: 16 }}>
            {qr?.dataUrl ? (
              <img src={qr.dataUrl} alt="扫码进入课堂" width={320} height={320} />
            ) : (
              <div style={{ width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>二维码加载中…</div>
            )}
          </div>
          <div style={{ color: '#e2e8f0', marginTop: 16, fontSize: 15 }}>手机扫码进入课堂 · 课堂码 {meta?.inviteCode || '------'} · 点击任意处关闭</div>
        </div>
      )}
    </>
  );
}
