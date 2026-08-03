'use client';

import { useEffect, useRef, useState } from 'react';
import { STYLE_ORDER } from '@/lib/styleProfiles';
import ScreenFinale from '@/components/ScreenFinale';

interface Summary {
  status: string;
  currentModuleId: string | null;
  moduleLocked: boolean;
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
  metrics: { entered: number; firstCall: number; usedMaterial: number; iterated: number; verified: number; submitted: number };
  aiStyle: { label: string; pct: number }[];
  taskClarity: { label: string; pct: number }[];
  materialUsage: { label: string; pct: number }[];
  styleCounts?: { one_shot: number; multi_round: number; stepwise: number };
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
  const [finaleActive, setFinaleActive] = useState(false);

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
            if (evt.type === 'module:advanced' || evt.type === 'module:locked') load(id);
            if (evt.type === 'classroom:reset') load(id);
            if (evt.type === 'classroom:closed') load(id);
            if (evt.type === 'analytics:update') { fetchAnalytics(id); fetchScreening(id); }
            if (evt.type === 'finale:enter') setFinaleActive(true);
            if (evt.type === 'finale:exit') setFinaleActive(false);
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
      // SSE 断连或漏事件时的兜底：每 5 秒主动拉一次最新状态
      const poll = setInterval(() => load(id), 5000);
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
    const s = await (await fetch(`/api/classroom/${id}`)).json();
    setSummary(s.summary);
    setModule(s.currentModule ?? null);
    setStartedAt(s.moduleStartedAt ?? null);
    setMeta({ inviteCode: s.inviteCode, courseName: s.courseName, createdAt: s.createdAt, scheduledStartAt: s.scheduledStartAt ?? null });
    fetchQr(id);
    if (s.currentModule?.type === 'ai_task' || s.currentModule?.type === 'class_mirror') fetchAnalytics(id);
    else if (s.currentModule?.type === 'hr_screening') fetchScreening(id);
  }
  async function fetchAnalytics(id: string) {
    try {
      const a = await (await fetch(`/api/analytics?sessionId=${id}`)).json();
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
        <h1 style={{ margin: 0, fontSize: 26 }}>{meta?.courseName || 'AI Agent 互动试听课'}</h1>
        <div style={{ fontSize: 18 }}>
          在线 <b style={{ color: 'var(--green)' }}>{summary?.onlineStudents ?? 0}</b> / {summary?.totalStudents ?? 0}
        </div>
      </div>

      {finaleActive ? (
        <ScreenFinale sessionId={sessionId} />
      ) : !sessionId ? (
        <p style={{ color: '#94a3b8' }}>请在教师端点击“打开大屏”后访问此页（需带 ?sessionId=）。</p>
      ) : summary?.status === 'closed' ? (
        <div style={{ textAlign: 'center', marginTop: '20vh' }}>
          <div style={{ fontSize: 44, fontWeight: 700 }}>本课堂已关闭</div>
          <div style={{ color: '#94a3b8', marginTop: 12, fontSize: 18 }}>学生已释放，本场已结束。教师开启新课堂后，请重新打开大屏。</div>
        </div>
      ) : !module ? (
        <A00Screen module={{ screenContent: { hook: '同一个任务，同一个 AI，结果会一样吗？' } } as unknown as ModuleDef} meta={meta} entered={summary?.totalStudents ?? 0} />
      ) : module.type === 'waiting' ? (
        <A00Screen module={module} meta={meta} entered={summary?.totalStudents ?? 0} />
      ) : module.type === 'hr_screening' ? (
        <A0Screen module={module} screening={screening} summary={summary} locked={summary?.moduleLocked ?? false} />
      ) : module.type === 'ai_task' ? (
        <A01Screen module={module} analytics={analytics} total={total} summary={summary} startedAt={startedAt} />
      ) : module.type === 'class_mirror' ? (
        <A02Screen module={module} analytics={analytics} total={total} />
      ) : module.type === 'lecture' ? (
        <A03Screen module={module} />
      ) : (
        <GenericScreen summary={summary} total={total} module={module} />
      )}

      {/* 右下角常驻扫码二维码：所有关卡都显示，学生扫码即入场 */}
      <QrCorner qr={qr} visible={!!sessionId} />
    </div>
  );
}


function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

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
  const ph = (module.teacherContent?.screenPhase1 ?? {}) as { headline?: string; subline?: string; brief?: string };
  const cfg = (module.teacherContent ?? {}) as {
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyMaterial(m: { id: string; title: string; body: string }) {
    try {
      await navigator.clipboard.writeText(m.body);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  }

  function citeMaterial(m: { id: string; title: string; body: string }) {
    const snippet = `【引用资料：${m.title}】\n${m.body}\n`;
    setChatInput((prev) => (prev ? prev + '\n' + snippet : snippet));
  }

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
    const next: ChatTurn[] = [...chatTurns, { role: 'user', content: text }];
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
            <div style={{ fontSize: 46, fontWeight: 800 }}>{ph.headline ?? 'AI 实战挑战'}</div>
            <div style={{ fontSize: 20, color: '#cbd5e1', marginTop: 6 }}>{ph.subline}</div>
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
            <p className="task-line"><b>目标用户：</b>{cfg.taskArea?.targetUser}</p>
            <p className="task-line"><b>目标：</b>{cfg.taskArea?.goal}</p>
            <p className="task-line"><b>可用资料：</b>{cfg.taskArea?.available}</p>
            <p className="task-line"><b>最终成果：</b>{cfg.taskArea?.finalDeliverable}</p>
            <p className="task-prompt">{cfg.prompt}</p>
            <ol className="req-list">
              {(cfg.requirements ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </div>

          <div className="zone material-zone">
            <h3>资料区</h3>
            <p className="zone-hint">每份资料右上角点「引用」直接把资料放进对话框交给 AI。</p>
            {(cfg.materials ?? []).map((m) => (
              <div key={m.id} className="material">
                <div className="material-head">
                  <div className="material-title">{m.title}</div>
                  <div className="material-actions">
                    <button type="button" className="mini-btn primary" onClick={() => citeMaterial(m)}>引用到对话</button>
                  </div>
                </div>
                <pre className="material-body">{m.body}</pre>
              </div>
            ))}
          </div>

          <div className="zone ai-zone">
            <h3>AI 操作区（大屏演示）</h3>
            <div className="chat-log">
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
      <div style={{ fontSize: 46, fontWeight: 800, marginBottom: 10 }}>{ph.headline ?? 'AI 实战挑战'}</div>
      <div style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 8 }}>{ph.subline}</div>
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
    </>
  );
}

function A02Screen({ module, analytics, total }: { module: ModuleDef; analytics: Analytics | null; total: number }) {
  const cfg = (module.teacherContent ?? {}) as {
    headline?: string;
    question?: string;
    paths?: { name: string; steps: string[] }[];
  };
  const m = analytics?.metrics;
  const counts = analytics?.styleCounts;
  const big = [
    { label: '使用给定资料', value: pct(m?.usedMaterial ?? 0, total) },
    { label: '二次追问/修改', value: pct(m?.iterated ?? 0, total) },
    { label: '主动验证依据', value: pct(m?.verified ?? 0, total) },
    { label: '已提交成果', value: pct(m?.submitted ?? 0, total) },
  ];
  return (
    <>
      <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 20 }}>{cfg.headline ?? '刚才，全班是怎样使用 AI 的？'}</div>
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', marginBottom: 28 }}>
        {big.map((b) => (
          <div key={b.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--blue)' }}>{b.value}%</div>
            <div style={{ color: '#94a3b8', fontSize: 15 }}>{b.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
        {(cfg.paths ?? []).map((p, i) => {
          const k = STYLE_ORDER[i];
          const cnt = (counts as any)?.[k] ?? 0;
          return (
            <div key={p.name} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--yellow)' }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>{cnt} 名学员属于此路径</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.8 }}>
                {p.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 22, marginTop: 32, color: 'var(--green)', fontWeight: 700 }}>{cfg.question}</p>
    </>
  );
}

function A03Screen({ module }: { module: ModuleDef }) {
  const cfg = (module.teacherContent ?? {}) as {
    headline?: string;
    bullets?: string[];
    comparison?: { bad: string; good: string };
  };
  return (
    <>
      <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 20 }}>{cfg.headline ?? '从聊天式使用到 Agent 式工作'}</div>
      <ul style={{ fontSize: 18, lineHeight: 2, maxWidth: 1000 }}>
        {(cfg.bullets ?? []).map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {cfg.comparison ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
          <div style={{ background: '#3f1d1d', border: '1px solid #7f1d1d', borderRadius: 12, padding: 16 }}>
            <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>做法 A（一次性）</div>
            <p style={{ margin: 0 }}>{cfg.comparison.bad}</p>
          </div>
          <div style={{ background: '#14331f', border: '1px solid #166534', borderRadius: 12, padding: 16 }}>
            <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 8 }}>做法 B（Agent 式）</div>
            <p style={{ margin: 0 }}>{cfg.comparison.good}</p>
          </div>
        </div>
      ) : null}
    </>
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

function A0Screen({
  module,
  screening,
  summary,
  locked,
}: {
  module: ModuleDef;
  screening: ScreeningData | null;
  summary: Summary | null;
  locked: boolean;
}) {
  if (locked) return <A0Reveal screening={screening} summary={summary} />;
  return <A0Live module={module} screening={screening} summary={summary} />;
}

// 状态一 + 状态二：AI 面试现场（进行中）
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
  const statusMsgs = ['正在读取回答……', '正在生成追问……', '正在寻找可信证据……', 'AI 面试官正在聆听……'];
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
        <div className="a0-brand">AI 简历标签挑战</div>
        <div className="a0-tag">AI 面试现场</div>
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
        <div className="a0-sub">请像真实面试一样回答，不必包装。</div>
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
        但面试官听到的证据，并不一样。
      </div>

      <div className="a0-snap">
        <div className="a0-snap-title">本班 AI 标签快照</div>
        <div className="a0-bars">
          {([['tool_user', 'AI工具体验者', '主要说明用过哪些工具'], ['task_solver', 'AI任务解决者', '能够说明解决了什么具体问题'], ['app_creator', 'AI应用创造者', '做出了可以被别人使用、验证或交付的应用']] as const).map(
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
        <div className="a0-samples-title">三条匿名回答 · 面试官识别到</div>
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

      <div className="a0-teacher-hint">教师追问：两个人都在使用 AI，为什么面试官给他们的标签不一样？</div>

      <div className="a0-next">让标签更有说服力：选择一个真实项目，补充"任务—行动—成果"</div>
    </div>
  );
}

function A00Screen({
  module,
  meta,
  entered,
}: {
  module: ModuleDef;
  meta: { inviteCode: string; courseName: string; createdAt: string | null; scheduledStartAt: string | null } | null;
  entered: number;
}) {
  const startAt = meta?.scheduledStartAt ? new Date(meta.scheduledStartAt) : null;
  const target = startAt ? startAt.getTime() : meta?.createdAt ? new Date(meta.createdAt).getTime() + 3 * 60 * 1000 : null;
  const sec = useCountdown(target);
  const startLabel = startAt
    ? `${startAt.getMonth() + 1}月${startAt.getDate()}日 ${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}`
    : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 30, color: 'var(--blue)', letterSpacing: 2 }}>{meta?.courseName || '课堂'}</div>
      <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.25, maxWidth: 1100 }}>
        如果明天参加面试，<br />HR问你“你会怎样使用AI？”
      </div>
      <div style={{ fontSize: 24, color: '#cbd5e1', marginTop: 4 }}>你的回答，能让面试官记住你吗？</div>
      <div style={{ marginTop: 8, padding: '14px 28px', border: '1px solid var(--yellow)', borderRadius: 12, background: 'rgba(250,204,21,0.08)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--yellow)' }}>AI面试官即将上线</div>
        <div style={{ fontSize: 16, color: '#cbd5e1', marginTop: 6 }}>请保持手机页面开启，按真实情况回答</div>
        {startLabel && (
          <div style={{ fontSize: 15, color: '#94a3b8', marginTop: 8 }}>开课时间：{startLabel}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 48, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 8 }}>课堂码</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 4, color: 'var(--green)' }}>{meta?.inviteCode || '------'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 8 }}>已进入</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{entered}<span style={{ fontSize: 20, color: '#94a3b8' }}> 人</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 8 }}>开课倒计时</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--yellow)' }}>{sec === 0 ? '已开课' : fmtCountdown(sec)}</div>
        </div>
      </div>
    </div>
  );
}

// 右下角常驻扫码二维码：所有关卡都显示，学生扫后进入课堂；点击放大，点遮罩收起
function QrCorner({ qr, visible }: { qr: { dataUrl: string; joinUrl: string } | null; visible: boolean }) {
  const [zoom, setZoom] = useState(false);
  if (!visible) return null;
  return (
    <>
      <button
        onClick={() => setZoom(true)}
        style={{ position: 'fixed', right: 28, bottom: 28, background: '#0f172a', border: '2px solid var(--blue)', borderRadius: 14, padding: 10, cursor: 'pointer', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', zIndex: 40 }}
        aria-label="扫码进入课堂"
      >
        {qr?.dataUrl ? (
          <img src={qr.dataUrl} alt="扫码进入课堂" width={120} height={120} />
        ) : (
          <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>二维码…</div>
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
              <img src={qr.dataUrl} alt="扫码进入课堂" width={360} height={360} />
            ) : (
              <div style={{ width: 360, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>二维码加载中…</div>
            )}
          </div>
          <div style={{ color: '#e2e8f0', marginTop: 16, fontSize: 15 }}>手机扫码进入课堂 · 点击任意处关闭</div>
        </div>
      )}
    </>
  );
}
