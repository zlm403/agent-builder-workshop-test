'use client';

import { useEffect, useRef, useState } from 'react';
import { STYLE_PROFILES, STYLE_ORDER } from '@/lib/styleProfiles';
import { LIFE_PRESETS } from '@/lib/world/presets';
import AvatarTeacher from '@/components/AvatarTeacher';
import MediaManager from '@/components/MediaManager';
import ContentPageEditor from '@/components/ContentPageEditor';
import BuiltinTextEditor from '@/components/BuiltinTextEditor';
import PreviewIframe from '@/components/PreviewIframe';

const pctOf = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0);

interface ModuleItem {
  id: string;
  title: string;
  type: string;
  teacherContent?: {
    headline?: string;
    subline?: string;
    bullets?: string[];
    note?: string;
    coreQuestion?: string;
    flow?: string[];
  };
}
interface Summary {
  sessionId: string;
  status: string;
  currentModuleId: string | null;
  moduleLocked: boolean;
  moduleSubState?: string | null;
  totalStudents: number;
  onlineStudents: number;
  totalSubmitted?: number;
  overview: { moduleId: string; title: string; completed: number; inProgress: number; stuck: number; notStarted: number }[];
}
interface Analytics {
  total: number;
  funnel: { label: string; count: number }[];
  taskClarity: { label: string; pct: number }[];
  materialUsage: { label: string; pct: number }[];
  aiStyle: { label: string; pct: number }[];
  styleCounts?: { one_shot: number; multi_round: number; stepwise: number };
  samples: { anonymousId: string; category: string; snippet: string }[];
  suggestions: { id: string; severity: string; title: string; detail: string; actions: string[] }[];
  metrics: { entered: number; firstCall: number; usedMaterial: number; iterated: number; verified: number; submitted: number };
  profiles: { anonymousId: string; rounds: number; usedMaterial: boolean; verified: boolean; modified: boolean; taskClarity: 'vague' | 'medium' | 'clear'; aiStyle: 'one_shot' | 'multi_round' | 'stepwise'; finalText?: string; firstUserPrompt: string }[];
}

interface ScreeningRow {
  anonymousId: string;
  answer: string;
  label: string;
}
interface ScreeningData {
  total: number;
  submitted: number;
  labels: { tool_user: number; task_solver: number; app_creator: number };
  revealSamples: { anonymousId: string; answer: string; label: string; dims: { tools: boolean; task: boolean; result: boolean; action: boolean } }[];
  rows: ScreeningRow[];
}

const AI_STYLE_LABEL: Record<string, string> = {
  one_shot: '一次性问答',
  multi_round: '多轮修改',
  stepwise: '分步工作流',
};
const CLARITY_LABEL: Record<string, string> = {
  clear: '明确对象+目标+成果',
  medium: '只说明大致目标',
  vague: '任务表述模糊',
};
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function TeacherPage() {
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [latestSession, setLatestSession] = useState<{ id: string; inviteCode?: string; status?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [expected, setExpected] = useState<number>(0);
  const [status, setStatus] = useState('pending');
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [moduleLocked, setModuleLocked] = useState(false);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [screening, setScreening] = useState<ScreeningData | null>(null);
  // 每个模块的分析数据历史（用于垂直堆叠展示所有模块）
  const [moduleHistory, setModuleHistory] = useState<
    Record<string, { type: 'a0'; data: ScreeningData } | { type: 'normal'; data: Analytics } | { type: 'a0n'; data: any } | { type: 'a1'; data: any }>
  >({});
  const [copiedShare, setCopiedShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jumpTarget, setJumpTarget] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState(() => toLocalInput(new Date(Date.now() + 10 * 60 * 1000)));
  const [ips, setIps] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<{ total: number; used: number; invitations: { id: string; code: string; used: boolean }[] } | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [thoughts, setThoughts] = useState<{ id: string; text: string; anonymousId: string; createdAt: string }[]>([]);
  const [showThoughts, setShowThoughts] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [ctrlOpen, setCtrlOpen] = useState(false); // 课堂块折叠（默认收起，上课不用）
  const [chapOpen, setChapOpen] = useState(true); // 章节块折叠（默认展开，可看可跳）
  const [stepOpen, setStepOpen] = useState(true); // 环节块折叠（默认展开，最常用）
  const [diagOpen, setDiagOpen] = useState(false); // 课堂诊断折叠
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingBuiltin, setEditingBuiltin] = useState<{ id: string; kind: string; refKey: string | null; overrides?: Record<string, string> | null } | null>(null);
  const [llmKey, setLlmKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.deepseek.com/v1');
  const [llmModel, setLlmModel] = useState('deepseek-chat');
  const [llmStatus, setLlmStatus] = useState<{ configured: boolean; maskedKey: string; baseUrl: string; model: string } | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const LS_KEY = 'teacherSessionId';

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) {
      // 没有本地课堂记录：自动尝试恢复后端正在进行的课堂
      (async () => {
        try {
          const r = await fetch('/api/classroom/latest');
          if (r.ok) {
            const s = await r.json();
            if (s && s.id) {
              if (!s.status || s.status !== 'ended') {
                const ok = await loadState(s.id).then(() => true).catch(() => false);
                if (ok) return;
                setLatestSession(s);
              } else {
                setLatestSession(s);
              }
            }
          }
        } catch {
          /* 忽略网络错误，展示创建入口 */
        } finally {
          setChecking(false);
        }
      })();
    } else {
      loadState(saved);
    }
    fetch('/api/network')
      .then((r) => r.json())
      .then((d) => setIps(d.ips || []))
      .catch(() => setIps([]));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (closed) return;
      const es = new EventSource(`/api/events/${sessionId}`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.type === 'progress:update') {
            setSummary(evt.payload);
            setCurrentModuleId(evt.payload.currentModuleId); // reset 后 currentModuleId 为 null，必须清空
            setModuleLocked(evt.payload.moduleLocked);
            setStatus(evt.payload.status);
            // 学生入场/签到会影响邀请码已用状态，实时刷新入场信息卡
            fetchInvitations(sessionId!);
          }
          if (evt.type === 'student:joined') {
            // 有人扫码进入，立即刷新「已签到」与邀请码列表
            fetchInvitations(sessionId!);
          }
          if (evt.type === 'module:advanced') {
            setCurrentModuleId(evt.payload.moduleId);
            fetchAnalytics(sessionId!, evt.payload.moduleId);
          }
          if (evt.type === 'module:locked') {
            setModuleLocked(evt.payload.locked);
          }
          if (evt.type === 'analytics:update') {
            fetchAnalytics(sessionId!, currentModuleId || undefined);
          }
          if (evt.type === 'classroom:reset') {
            setModuleHistory({});
            loadState(sessionId!);
          }
          if (evt.type === 'classroom:closed') {
            loadState(sessionId!);
          }
          if (evt.type === 'thought:new') {
            fetchThoughts(sessionId!);
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
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const v = localStorage.getItem(`expected_${sessionId}`);
    setExpected(v ? Number(v) : 0);
  }, [sessionId]);

  async function fetchAnalytics(id: string, moduleId = 'A01_BASELINE') {
    try {
      if (moduleId === 'A0_SCREENING') {
        const res = await fetch(`/api/screening/analytics?sessionId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setScreening(data);
          setAnalytics(null);
          setModuleHistory((prev) => ({ ...prev, [moduleId]: { type: 'a0', data } }));
        }
      } else if (['A0N_QUESTIONS', 'A0N_VOTE', 'A0N_REVEAL'].includes(moduleId)) {
        const res = await fetch(`/api/avatar/a0/analytics?sessionId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setScreening(null);
          setModuleHistory((prev) => ({ ...prev, [moduleId]: { type: 'a0n', data } }));
        }
      } else if (moduleId === 'A1_AVATAR') {
        const res = await fetch(`/api/avatar/a1/analytics?sessionId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setScreening(null);
          setModuleHistory((prev) => ({ ...prev, [moduleId]: { type: 'a1', data } }));
        }
      } else {
        const res = await fetch(`/api/analytics?sessionId=${id}&moduleId=${moduleId}`);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
          setScreening(null);
          setModuleHistory((prev) => ({ ...prev, [moduleId]: { type: 'normal', data } }));
        }
      }
    } catch {
      /* noop */
    }
  }
  async function fetchInvitations(id: string) {
    try {
      const res = await fetch(`/api/classroom/${id}/invitations`);
      if (res.ok) setInvitations(await res.json());
    } catch {
      /* noop */
    }
  }
  async function fetchThoughts(id: string) {
    try {
      const res = await fetch(`/api/classroom/${id}/thoughts`);
      if (res.ok) {
        const d = await res.json();
        setThoughts(d?.thoughts ?? []);
      }
    } catch {
      /* noop */
    }
  }
  async function generateInvitations(count: number) {
    if (!sessionId || count < 1) return;
    setGenBusy(true);
    try {
      const res = await fetch(`/api/classroom/${sessionId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      if (res.ok) {
        await fetchInvitations(sessionId);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`生成邀请码失败：${d.error?.message || res.statusText}`);
      }
    } catch (err) {
      alert(`生成邀请码失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenBusy(false);
    }
  }

  async function loadState(id: string) {
    setSessionId(id);
    localStorage.setItem(LS_KEY, id);
    try {
      const res = await fetch(`/api/classroom/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const state = await res.json();
      if (state.error) throw new Error(state.error.message || state.error.code);
      setInviteCode(state.inviteCode);
      setStatus(state.status);
      setCurrentModuleId(state.currentModuleId);
      setModuleLocked(state.moduleLocked);
      setModules(state.modules ?? []);
      setSummary(state.summary);
      fetchInvitations(id);
      fetchThoughts(id);
      if (state.currentModuleId) fetchAnalytics(id, state.currentModuleId);
      fetchSettings();
    } catch (err) {
      console.warn('loadState failed for', id, err);
      // Session 不存在时，自动回退到最新有效 session
      try {
        const latestRes = await fetch('/api/classroom/latest');
        if (latestRes.ok) {
          const latest = await latestRes.json();
          if (latest.id && latest.id !== id) {
            console.log('Falling back to latest session:', latest.id);
            localStorage.setItem(LS_KEY, latest.id);
            loadState(latest.id);
            return;
          }
        }
      } catch { /* ignore */ }
      // 真的没有可用 session
      setChecking(false);
      setSessionId('');
      localStorage.removeItem(LS_KEY);
      alert('课堂不存在，请创建新课堂。');
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings/llm');
      if (!res.ok) return;
      const d = await res.json();
      setLlmStatus(d);
      setLlmBaseUrl(d.baseUrl || 'https://api.deepseek.com/v1');
      setLlmModel(d.model || 'deepseek-chat');
    } catch {
      /* noop */
    }
  }

  async function saveSettings(clear = false) {
    if (!clear && !llmKey.trim()) {
      alert('请输入 DeepSeek API Key');
      return;
    }
    setSettingsBusy(true);
    try {
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: clear ? '' : llmKey.trim(),
          baseUrl: llmBaseUrl.trim(),
          model: llmModel.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        alert(`保存失败：${d.error?.message || d.error || res.statusText}`);
        return;
      }
      setLlmStatus(d);
      setLlmKey('');
      setSettingsOpen(false);
      if (clear) {
        alert('已恢复为离线 mock 模式');
      } else {
        alert(`API Key 已保存并生效\n当前模型：${d.model}\nKey：${d.maskedKey}`);
      }
    } catch (err) {
      alert(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSettingsBusy(false);
    }
  }

  async function createClassroom() {
    if (busy) return;
    setBusy(true);
    try {
      // 新建课堂前，先关闭当前正在运行的旧课堂，避免堆积多个未关闭的课堂
      if (sessionId && status !== 'closed') {
        try {
          await fetch(`/api/classroom/${sessionId}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'close' }),
          });
        } catch {
          /* 关闭旧课堂失败不阻断新建 */
        }
      }
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'A', scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`创建课堂失败：${data?.error?.message || res.statusText || '未知错误'}`);
        return;
      }
      if (!data.id) {
        alert('创建课堂失败：返回数据缺少课堂 ID');
        return;
      }
      await loadState(data.id);
    } catch (err) {
      alert(`创建课堂失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function control(action: string, extra: Record<string, unknown> = {}) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/classroom/${sessionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) { console.warn('control failed', action, res.status); return; }
      // reset 时清空模块历史数据，避免旧诊断残留
      if (action === 'reset') setModuleHistory({});
      loadState(sessionId);
    } catch (err) {
      console.error('control error', action, err);
      alert(`操作失败：${err instanceof Error ? err.message : String(err)}\n请检查网络后重试`);
    } finally {
      setBusy(false);
    }
  }

  // ===== 模块卡片渲染函数 =====
  function renderDirs(dirs: { kind: 'more' | 'less' | 'watch' | 'good'; text: string }[]) {
    const colorOf = (k: string) =>
      k === 'more' ? 'var(--blue)' : k === 'less' ? 'var(--green)' : k === 'watch' ? 'var(--yellow)' : 'var(--muted)';
    return (
      <div className="dir-list">
        {dirs.map((d, i) => (
          <div key={i} className="dir-item">
            <span className="dir-dot" style={{ background: colorOf(d.kind) }} />
            <span>{d.text}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderA0Card(data: ScreeningData) {
    const total = data.labels.tool_user + data.labels.task_solver + data.labels.app_creator;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const dirs = buildA0Dirs(data);
    return (
      <div className="module-card-body">
        {/* 核心指标 */}
        <div className="card-metrics">
          <div><b>{summary?.totalStudents ?? 0}</b><span>已扫码入场</span></div>
          <div><b>{data.submitted}</b><span>已提交回答</span></div>
        </div>
        {/* 教学方向建议 */}
        <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>教学方向建议</h4>
        {renderDirs(dirs)}
        {/* AI 标签占比 */}
        <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>AI 标签分布</h4>
        <div className="label-dist">
          {[
            { key: 'tool_user' as const, label: 'AI 路人', color: 'yellow', count: data.labels.tool_user },
            { key: 'task_solver' as const, label: 'AI 搭子', color: 'blue', count: data.labels.task_solver },
            { key: 'app_creator' as const, label: 'AI 合伙人', color: 'green', count: data.labels.app_creator },
          ].map((item) => (
            <div key={item.key} className="label-dist-row">
              <span>{item.label}</span>
              <div className="dist-bar"><span style={{ width: `${pct(item.count)}%` }} /></div>
              <b>{item.count}人 ({pct(item.count)}%)</b>
            </div>
          ))}
        </div>
        <p className="hint" style={{ padding: '10px 16px 4px' }}>学员逐人明细与代表性样本请见「模式 → 学员明细」。</p>
      </div>
    );
  }

  function renderA0NCard(data: any) {
    const total = data?.total ?? 0;
    const done = data?.answered ?? 0;
    const tool = data?.tool ?? 0;
    const partner = data?.partner ?? 0;
    return (
      <div className="module-card-body">
        <div className="card-metrics">
          <div><b>{total}</b><span>已扫码入场</span></div>
          <div><b>{done}</b><span>已提交回答</span></div>
        </div>
        {tool > 0 || partner > 0 ? (
          <>
            <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>关系题投票</h4>
            <div className="label-dist">
              {[
                { label: '工具', count: tool, color: 'yellow' },
                { label: '伙伴', count: partner, color: 'blue' },
              ].map((v) => (
                <div key={v.label} className="label-dist-row">
                  <span>{v.label}</span>
                  <div className="dist-bar"><span style={{ width: `${total ? (v.count / total) * 100 : 0}%` }} /></div>
                  <b>{v.count}人</b>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <p className="hint" style={{ padding: '10px 16px 4px' }}>
          {data?.finished || data?.walls ? `${data.walls ?? data.finished ?? 0} 条朋友圈作品` : '学生端三问回答进行中，收齐后进入关系题投票。'}
        </p>
      </div>
    );
  }

  function renderA1Card(data: any) {
    const done = data?.submitted ?? 0;
    const walls = data?.walls ?? 0;
    const total = data?.total ?? 0;
    return (
      <div className="module-card-body">
        <div className="card-metrics">
          <div><b>{total}</b><span>已扫码入场</span></div>
          <div><b>{done}</b><span>已完成六步对话</span></div>
          <div><b>{walls}</b><span>朋友圈作品</span></div>
        </div>
        <p className="hint" style={{ padding: '10px 16px 4px' }}>
          A1 · 手机端一个对话框连续六步；大屏六格逐一点亮，收齐后展示全班朋友圈作品墙。
        </p>
      </div>
    );
  }

  function renderStyleOverview(data: Analytics) {
    const sc = data.styleCounts ?? { one_shot: 0, multi_round: 0, stepwise: 0 };
    const sum = sc.one_shot + sc.multi_round + sc.stepwise;
    const order = STYLE_ORDER;
    return (
      <div className="style-overview">
        <div className="style-cards">
          {order.map((key) => {
            const p = STYLE_PROFILES[key];
            const cnt = sc[key];
            const pct = sum > 0 ? Math.round((cnt / sum) * 100) : 0;
            return (
              <div key={key} className="style-card" style={{ borderLeftColor: key === 'one_shot' ? 'var(--yellow)' : key === 'multi_round' ? 'var(--blue)' : 'var(--green)' }}>
                <div className="style-card-top">
                  <b>{p.label}</b>
                  <span className="style-count">{cnt}人 · {pct}%</span>
                </div>
                <div className="style-bar"><span style={{ width: `${pct}%`, background: key === 'one_shot' ? 'var(--yellow)' : key === 'multi_round' ? 'var(--blue)' : 'var(--green)' }} /></div>
                <p className="style-one">{p.oneLiner}</p>
                <p className="style-hint">{p.teacherHint}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderNormalCard(data: Analytics) {
    const dirs = (() => {
      const out: { kind: 'more' | 'less' | 'watch' | 'good'; text: string }[] = [];
      if (data.total > 0) {
        const usedMatPct = pctOf(data.metrics.usedMaterial, data.total);
        const oneShotPct = pctOf(data.profiles.filter((p) => p.aiStyle === 'one_shot').length, data.total);
        const verifiedPct = pctOf(data.metrics.verified, data.total);
        const submittedPct = pctOf(data.metrics.submitted, data.total);
        const vaguePct = pctOf(data.profiles.filter((p) => p.taskClarity === 'vague').length, data.total);
        const swCount = data.profiles.filter((p) => p.aiStyle === 'stepwise').length;
        if (usedMatPct < 50) out.push({ kind: 'more', text: `多说：让学员给 AI 喂资料 / 依据（目前仅 ${usedMatPct}% 用到资料）` });
        else if (usedMatPct >= 70) out.push({ kind: 'less', text: `资料使用已较好（${usedMatPct}%），可少讲资料边界，直接进验证环节` });
        if (oneShotPct >= 40) out.push({ kind: 'more', text: `多说：把模糊问题拆成步骤（${oneShotPct}% 学员仍是一次提问）` });
        if (verifiedPct < 40) out.push({ kind: 'more', text: `多说：拿到答案后如何追问 / 验证依据（仅 ${verifiedPct}% 做了验证）` });
        if (swCount > 0 && swCount / data.total >= 0.4) out.push({ kind: 'less', text: `${swCount} 人已会分步使用，可加快节奏或给进阶挑战` });
        if (submittedPct < 60) out.push({ kind: 'watch', text: `稍放慢：先澄清任务要求再让学员动手（仅 ${submittedPct}% 提交）` });
        if (vaguePct >= 40) out.push({ kind: 'more', text: `多说：下指令前先明确"我要什么"（${vaguePct}% 任务描述偏模糊）` });
        if (out.length === 0) out.push({ kind: 'good', text: '本阶段整体表现均衡，可保持当前节奏。' });
      } else {
        out.push({ kind: 'good', text: '暂无操作数据。' });
      }
      return out;
    })();
    return (
      <div className="module-card-body">
        {/* 核心指标 */}
        <div className="card-metrics">
          <div><b>{summary?.totalStudents ?? 0}</b><span>已扫码入场</span></div>
          <div><b>{data.total}</b><span>有操作记录</span></div>
          <div><b>{data.metrics.submitted ?? 0}</b><span>已完成提交</span></div>
        </div>
        {/* 教学方向建议 */}
        <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>教学方向建议</h4>
        {renderDirs(dirs)}
        {/* 全班分类概览 */}
        <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>全班分类概览（实操方式）</h4>
        {renderStyleOverview(data)}
        {/* 行为漏斗 */}
        {data.funnel && data.funnel.length > 0 && (
          <>
            <h4 style={{ margin: '12px 16px 8px', fontSize: 14 }}>行为漏斗</h4>
            <div className="funnel" style={{ padding: '0 16px' }}>
              {data.funnel.map((f) => {
                const ft = data.total || 1;
                return (
                  <div key={f.label} className="funnel-row">
                    <span className="funnel-label">{f.label}</span>
                    <span className="funnel-bar"><span style={{ width: `${(f.count / ft) * 100}%` }} /></span>
                    <span className="funnel-count">{f.count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {/* 分布图 */}
        {(data.taskClarity?.length || data.materialUsage?.length || data.aiStyle?.length) && (
          <div className="dist-grid" style={{ padding: '0 16px 12px' }}>
            {data.taskClarity && data.taskClarity.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13 }}>任务清晰度</h4>
                {data.taskClarity.map((d) => (
                  <div key={d.label} className="dist-row"><span>{d.label}</span><span className="dist-bar"><span style={{ width: `${d.pct}%` }} /></span><b>{d.pct}%</b></div>
                ))}
              </div>
            )}
            {data.materialUsage && data.materialUsage.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13 }}>资料使用</h4>
                {data.materialUsage.map((d) => (
                  <div key={d.label} className="dist-row"><span>{d.label}</span><span className="dist-bar"><span style={{ width: `${d.pct}%` }} /></span><b>{d.pct}%</b></div>
                ))}
              </div>
            )}
            {data.aiStyle && data.aiStyle.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13 }}>AI 使用方式</h4>
                {data.aiStyle.map((d) => (
                  <div key={d.label} className="dist-row"><span>{d.label}</span><span className="dist-bar"><span style={{ width: `${d.pct}%` }} /></span><b>{d.pct}%</b></div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="hint" style={{ padding: '10px 16px 4px' }}>学员逐人明细与代表性样本请见「模式 → 学员明细」。</p>
      </div>
    );
  }

  if (!sessionId) {
    const port = typeof window !== 'undefined' ? window.location.port : '3000';
    const navStyle: React.CSSProperties = {
      flex: 1,
      textAlign: 'center',
      padding: '10px 0',
      borderRadius: 8,
      border: '1px solid #334155',
      color: '#e2e8f0',
      textDecoration: 'none',
      fontSize: 15,
      background: '#0f172a',
      transition: 'border-color .15s',
    };
    return (
      <div className="container">
        <h1>教师导演台</h1>
        <div className="card">
          {checking && (
            <p style={{ color: 'var(--blue)', marginBottom: 10 }}>
              正在检查是否有进行中的课堂…
            </p>
          )}
          {!checking && latestSession && latestSession.status && latestSession.status !== 'ended' && (
            <p style={{ color: 'var(--green)', marginBottom: 10 }}>
              发现进行中的课堂（邀请码：<b>{latestSession.inviteCode}</b>），正在恢复…
            </p>
          )}
          <p style={{ margin: checking ? 0 : undefined }}>
            先创建一场课堂，系统会自动生成邀请码（学生扫码进入，大屏常驻二维码）。
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px' }}>
            <label htmlFor="startAt" style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>开课时间</label>
            <input
              id="startAt"
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 15 }}
            />
          </div>
          <button onClick={createClassroom} disabled={busy}>
            {busy ? '创建中…' : '创建课堂'}
          </button>

          {/* 角色导航入口 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 24, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
            <a href="/teacher" style={navStyle}>教师端</a>
            <a href={`/screen?code=${inviteCode || ''}`} style={navStyle}>大屏幕</a>
            <a href="/student" style={navStyle}>学生端</a>
          </div>
        </div>
      </div>
    );
  }

  const m = (analytics?.metrics) ?? null;

  const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const currentMod = modules.find((mm) => mm.id === currentModuleId);
  const currentModTitle = currentMod?.title || currentModuleId || 'A01_BASELINE';
  const tc = currentMod?.teacherContent;
  const stepwiseCount = analytics ? analytics.profiles.filter((p) => p.aiStyle === 'stepwise').length : 0;

  const dirList: { kind: 'more' | 'less' | 'watch' | 'good'; text: string }[] = [];
  if (analytics && analytics.total > 0) {
    const usedMatPct = pctOf(analytics.metrics.usedMaterial, analytics.total);
    const oneShotPct = pctOf(analytics.profiles.filter((p) => p.aiStyle === 'one_shot').length, analytics.total);
    const verifiedPct = pctOf(analytics.metrics.verified, analytics.total);
    const submittedPct = pctOf(analytics.metrics.submitted, analytics.total);
    const vaguePct = pctOf(analytics.profiles.filter((p) => p.taskClarity === 'vague').length, analytics.total);
    if (usedMatPct < 50) dirList.push({ kind: 'more', text: `多说：让学员给 AI 喂资料 / 依据（目前仅 ${usedMatPct}% 用到资料）` });
    else if (usedMatPct >= 70) dirList.push({ kind: 'less', text: `资料使用已较好（${usedMatPct}%），可少讲资料边界，直接进入验证环节` });
    if (oneShotPct >= 40) dirList.push({ kind: 'more', text: `多说：把模糊问题拆成步骤（${oneShotPct}% 学员仍是一次提问）` });
    if (verifiedPct < 40) dirList.push({ kind: 'more', text: `多说：拿到答案后如何追问 / 验证依据（仅 ${verifiedPct}% 做了验证）` });
    if (stepwiseCount > 0 && stepwiseCount / analytics.total >= 0.4) dirList.push({ kind: 'less', text: `${stepwiseCount} 人已会分步使用，可加快节奏或加进阶挑战` });
    if (submittedPct < 60) dirList.push({ kind: 'watch', text: `稍放慢：先澄清任务要求再让学员动手（仅 ${submittedPct}% 提交）` });
    if (vaguePct >= 40) dirList.push({ kind: 'more', text: `多说：下指令前先明确"我要什么"（${vaguePct}% 任务描述偏模糊）` });
    if (dirList.length === 0) dirList.push({ kind: 'good', text: '本阶段整体表现均衡，可保持当前节奏。' });
  }

  const isA0 = currentModuleId === 'A0_SCREENING';
  const isA0New = currentModuleId === 'A0N_QUESTIONS' || currentModuleId === 'A0N_VOTE' || currentModuleId === 'A0N_REVEAL' || currentModuleId === 'A1_AVATAR' || currentModuleId === 'A2_SITE' || currentModuleId === 'A3_WORLD' || currentModuleId === 'CLOSING';

  function buildA0Dirs(s: ScreeningData | null): { kind: 'more' | 'less' | 'watch' | 'good'; text: string }[] {
    const out: { kind: 'more' | 'less' | 'watch' | 'good'; text: string }[] = [];
    if (!s) return out;
    const tot = s.total || 1;
    if (s.labels.tool_user / tot >= 0.4)
      out.push({ kind: 'more', text: `多引导：让更多人和 AI 从"打个照面"走向"一起办成事"（${s.labels.tool_user} 人还是路人）` });
    if (s.labels.app_creator > 0)
      out.push({ kind: 'less', text: `少讲基础：${s.labels.app_creator} 人已和 AI 深度共创，可加快或给进阶挑战` });
    if (out.length === 0) out.push({ kind: 'good', text: '本环节表现均衡，可保持节奏进入下一环节。' });
    return out;
  }
  const a0Dirs = buildA0Dirs(screening);

  async function copyShare() {
    const lines: string[] = [`【课堂回执 · ${currentModTitle}】`];
    lines.push(`签到在线：${summary?.onlineStudents ?? 0}/${summary?.totalStudents ?? 0}`);
    if (analytics && analytics.total > 0) {
      lines.push(`已调用 AI：${analytics.metrics.firstCall} 人`);
      lines.push(`使用资料：${analytics.metrics.usedMaterial} 人`);
      lines.push(`完成提交：${analytics.metrics.submitted} 人（${pctOf(analytics.metrics.submitted, summary?.totalStudents || analytics.total)}%）`);
      lines.push(`高阶·分步使用：${stepwiseCount} 人`);
      lines.push('');
      lines.push('AI 使用方式：' + analytics.aiStyle.map((d) => `${d.label} ${d.pct}%`).join(' / '));
      lines.push('任务清晰度：' + analytics.taskClarity.map((d) => `${d.label} ${d.pct}%`).join(' / '));
      lines.push('');
      lines.push('教学方向：');
      dirList.forEach((d) => lines.push(`· ${d.text}`));
      lines.push('');
      lines.push('下节课改进：');
      analytics.suggestions.forEach((s) => lines.push(`· ${s.title}：${s.detail}`));
    }
    if (isA0 && screening) {
      lines.push(`已提交回答：${screening.submitted}/${summary?.totalStudents ?? 0}`);
      lines.push(`AI 标签分布：路人 ${screening.labels.tool_user} 人 · 搭子 ${screening.labels.task_solver} 人 · 合伙人 ${screening.labels.app_creator} 人`);
      lines.push('');
      lines.push('教学方向：');
      buildA0Dirs(screening).forEach((d) => lines.push(`· ${d.text}`));
      lines.push('');
      lines.push('（完整销售简报请点「生成并复制销售简报」）');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1800);
    } catch {
      /* clipboard 不可用 */
    }
  }

  async function copySalesBrief() {
    try {
      const res = await fetch(`/api/screening/sales-brief?sessionId=${sessionId}`);
      const d = await res.json();
      if (!res.ok) {
        alert('生成销售简报失败');
        return;
      }
      await navigator.clipboard.writeText(d.text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1800);
    } catch {
      /* clipboard 不可用 */
    }
  }

  return (
    <>
      <div className="status-bar">
        <div><span className="label">状态</span><span className="pill">{status}</span></div>
        <div><span className="label">在线</span>{summary?.onlineStudents ?? 0}/{summary?.totalStudents ?? 0}</div>
        <div><span className="label">当前</span>{currentModuleId ?? '未开始'}</div>
        <div><span className="label">锁定</span><span className={`pill ${moduleLocked ? 'red' : 'green'}`}>{moduleLocked ? '已锁定' : '开放'}</span></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="secondary"
            onClick={() => setSettingsOpen(true)}
            title="LLM API 设置"
          >
            设置 ⚙️
          </button>
          <button
            className="secondary"
            onClick={() => setShowMedia(true)}
            title="课堂媒体库（视频/图片管理）"
          >
            媒体库 🎬
          </button>
          <a href={`/screen?sessionId=${sessionId}`} target="_blank" rel="noreferrer">
            <button className="secondary">打开大屏 ↗</button>
          </a>
          {inviteCode && (
            <a href={`/student?code=${inviteCode}`} target="_blank" rel="noreferrer">
              <button className="secondary">进入学生端 ↗</button>
            </a>
          )}
        </div>
      </div>

      {status === 'closed' && (
        <div className="container">
          <div className="card" style={{ borderColor: 'var(--yellow)', background: 'rgba(250,204,21,0.08)' }}>
            <h3 style={{ marginTop: 0 }}>本课堂已关闭</h3>
            <p style={{ margin: 0 }}>学生已被释放，本场已结束。如需再次上课，请点击右上角「创建课堂」开启新的一场（新课堂会生成新的课堂码，与之前互不影响）。</p>
          </div>
        </div>
      )}

      {tc && (tc.headline || tc.bullets?.length || tc.coreQuestion) && (
        <div className="teach-content" style={{ marginBottom: 16 }}>
          {tc.headline && <h3 className="tc-headline" style={{ marginTop: 0 }}>{tc.headline}</h3>}
          {tc.subline && <p className="tc-note" style={{ marginTop: 0 }}>{tc.subline}</p>}
          {tc.bullets?.length ? (
            <ul className="tc-bullets">
              {tc.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
          {tc.coreQuestion && (
            <p className="tc-note" style={{ marginTop: 8 }}>
              <b>核心问题：</b>{tc.coreQuestion}
            </p>
          )}
          {tc.flow?.length ? (
            <p className="tc-note" style={{ marginTop: 8 }}>
              <b>流程：</b>{tc.flow.join(' → ')}
            </p>
          ) : null}
        </div>
      )}

      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 430px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 12 }}>
          {/* 块1：课堂（默认收起） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }} onClick={() => setCtrlOpen(!ctrlOpen)}>
            <h3 style={{ margin: 0, fontSize: 15 }}>课堂 {ctrlOpen ? '▾' : '▸'}</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ctrlOpen ? '收起' : '展开'}</span>
          </div>
          {ctrlOpen && (
          <>
          <p>课堂码：<b style={{ fontSize: 20, letterSpacing: 2 }}>{inviteCode}</b>（学生扫码进入，屏幕大屏常驻二维码）</p>
          <div className="row" style={{ alignItems: 'center', marginTop: 10 }}>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>应到人数</span>
            <input
              type="number"
              min={0}
              value={expected}
              onChange={(e) => {
                const n = Number(e.target.value) || 0;
                setExpected(n);
                if (sessionId) localStorage.setItem(`expected_${sessionId}`, String(n));
              }}
              style={{ width: 80 }}
            />
            <button
              className="secondary"
              disabled={genBusy || expected < 1}
              onClick={() => generateInvitations(expected)}
              style={{ marginLeft: 10 }}
            >
              {genBusy ? '生成中…' : `生成 ${expected || 0} 个邀请码`}
            </button>
          </div>
          <div className="row" style={{ alignItems: 'center', marginTop: 10 }}>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>已生成</span>
            <b style={{ fontSize: 22, color: 'var(--blue)' }}>{invitations?.total ?? 0}</b>
            <span style={{ color: 'var(--muted)', fontSize: 14, marginRight: 16 }}> 个邀请码</span>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>已签到</span>
            <b style={{ fontSize: 22, color: 'var(--green)' }}>{invitations?.used ?? 0}</b>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}> 人</span>
          </div>
          {expected > 0 && (invitations?.used ?? 0) < expected ? (
            <p style={{ color: 'var(--red)', marginTop: 10 }}>
              还有 {expected - (invitations?.used ?? 0)} 人未签到，请提醒他们扫码并输入个人邀请码。
            </p>
          ) : expected > 0 && (invitations?.used ?? 0) >= expected ? (
            <p style={{ color: 'var(--green)', marginTop: 10 }}>已到齐，可以开始。</p>
          ) : null}

          {invitations && invitations.total > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>邀请码列表（绿色=已使用）</span>
                <button
                  className="secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    const text = invitations.invitations.map((i) => i.code).join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                >
                  复制全部
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 140, overflowY: 'auto', padding: 8, background: 'var(--card)', borderRadius: 8 }}>
                {invitations.invitations.map((i) => (
                  <span
                    key={i.id}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 13,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: i.used ? 'var(--green)' : 'var(--border)',
                      color: i.used ? '#052e16' : 'var(--fg)',
                    }}
                  >
                    {i.code}
                  </span>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {/* 块2：章节（默认展开，可看可跳） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }} onClick={() => setChapOpen(!chapOpen)}>
            <h3 style={{ margin: 0, fontSize: 15 }}>章节 {chapOpen ? '▾' : '▸'}</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{chapOpen ? '收起' : '展开'}</span>
          </div>
          {chapOpen && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(() => {
              const a0Ids = ['A0N_QUESTIONS', 'A0N_VOTE', 'A0N_REVEAL'];
              const groups: { id: string; title: string; sub: string[] }[] = [];
              const seenA0 = { done: false };
              for (const mm of modules) {
                if (a0Ids.includes(mm.id)) {
                  if (!seenA0.done) { groups.push({ id: mm.id, title: '我和AI', sub: a0Ids }); seenA0.done = true; }
                } else {
                  const short = (mm.title || mm.id).slice(0, 6);
                  groups.push({ id: mm.id, title: short, sub: [mm.id] });
                }
              }
              return groups.map((g) => {
                const isActive = g.sub.includes(String(currentModuleId));
                const activeIndex = currentModuleId ? modules.findIndex((m) => m.id === currentModuleId) : -1;
                const isDone = activeIndex !== -1 && modules.findIndex((m) => m.id === g.id) < activeIndex;
                return (
                  <button
                    key={g.id}
                    className={`secondary`}
                    onClick={() => control('jump', { targetModuleId: g.sub[0] })}
                    style={{
                      fontSize: 13, padding: '6px 14px', borderRadius: 999,
                      border: isActive ? '2px solid var(--blue)' : '1px solid var(--border)',
                      background: isActive ? 'rgba(56,189,248,0.18)' : isDone ? 'rgba(34,197,94,0.12)' : 'var(--card)',
                      color: isActive ? 'var(--blue)' : isDone ? 'var(--green)' : 'var(--muted)',
                      fontWeight: isActive ? 800 : 500,
                    }}
                  >
                    {isDone ? '✓ ' : ''}{g.title}
                  </button>
                );
              });
            })()}
          </div>
          )}

          {/* 块3：环节（默认展开，最常用） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }} onClick={() => setStepOpen(!stepOpen)}>
            <h3 style={{ margin: 0, fontSize: 15 }}>环节 {stepOpen ? '▾' : '▸'}</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{stepOpen ? '收起' : '展开'}</span>
          </div>
          {stepOpen && (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isA0New ? (
              <>
                {/* 课堂操作区（一整行） */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}>课堂操作</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="secondary" disabled={status === 'active' || status === 'closed' || busy} onClick={() => control('start')}>开始课堂</button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('确定重置课堂吗？将清空所有学生信息、答题记录和邀请码，回到等待开始状态。')) {
                          control('reset');
                        }
                      }}
                    >
                      重置课堂
                    </button>
                    <button
                      className="danger"
                      disabled={busy || status === 'closed'}
                      onClick={() => {
                        if (window.confirm('确定关闭本课堂吗？将释放所有学生并结束本场，之后可创建新课堂（新课堂码与之前互不影响）。')) {
                          control('close');
                        }
                      }}
                    >
                      关闭课堂
                    </button>
                  </div>
                </div>

                {/* 环节操作区（一整行） */}
                <div style={{ border: '1px solid rgba(124,58,237,0.5)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>环节操作</span>
                    <button
                      className="danger"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('确定重置本环节吗？全班学生在本环节的进度将被清空，重新从第一步开始。')) {
                          control('resetModule', { moduleId: currentModuleId });
                        }
                      }}
                    >
                      ⟲ 重置本环节
                    </button>
                  </div>
                  <AvatarTeacher
                    moduleId={currentModuleId}
                    subState={summary?.moduleSubState ?? null}
                    busy={busy}
                    control={control}
                    onEditContent={(pageId) => setEditingPageId(pageId)}
                    onEditText={(page) => setEditingBuiltin({ id: page.id, kind: page.kind, refKey: page.refKey, overrides: page.overrides })}
                  />
                  {(currentModuleId === 'A0N_REVEAL' && summary?.moduleSubState === 'a0:closing') && (
                    <VideoControlBar
                      control={control}
                      busy={busy}
                      title="收束视频"
                      url="/api/media/file/1786677398421-7ncl82.mp4"
                    />
                  )}
                  {(currentModuleId === 'A1_AVATAR' && summary?.moduleSubState === 'avatar:c9') && (
                    <VideoControlBar
                      control={control}
                      busy={busy}
                      title="现实视频"
                    />
                  )}
                  {currentModuleId === 'A3_WORLD' && (
                    <WorldVisualBar />
                  )}
                  {currentModuleId === 'A3_WORLD' && (
                    <WorldPresetBar />
                  )}
                  {currentModuleId === 'A3_WORLD' && (
                    <WorldTipsBar />
                  )}
                  {currentModuleId === 'CLOSING' && (
                    (String(summary?.moduleSubState ?? '').startsWith('closing:wings')) ? (
                      <FourWingsTeacherBar
                        subState={summary?.moduleSubState ?? null}
                        busy={busy}
                        control={control}
                      />
                    ) : (String(summary?.moduleSubState ?? '').startsWith('closing:price')) ? (
                      <PriceRevealTeacherBar
                        subState={summary?.moduleSubState ?? null}
                        busy={busy}
                        control={control}
                      />
                    ) : (
                      <PainWallTeacherBar
                        subState={summary?.moduleSubState ?? null}
                        busy={busy}
                        control={control}
                      />
                    )
                  )}
                  <button className="secondary" style={{ alignSelf: 'flex-start' }} disabled={busy || status === 'closed'} onClick={() => control('lock', { locked: !moduleLocked })}>
                    {moduleLocked ? '解锁学员输入' : '锁定学员输入'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="secondary" disabled={status === 'active' || status === 'closed' || busy} onClick={() => control('start')}>开始课堂</button>
                {isA0 && typeof summary?.moduleSubState === 'string' && summary.moduleSubState.startsWith('story') ? (
                  <div className="story-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="secondary"
                      disabled={busy || status === 'closed' || summary.moduleSubState === 'story:1'}
                      onClick={() => control('setSubState', { subState: 'story:1' })}
                    >
                      上页
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || status === 'closed' || summary.moduleSubState === 'story:2'}
                      onClick={() => control('setSubState', { subState: 'story:2' })}
                    >
                      下页
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || status === 'closed' || summary.moduleSubState === 'story:1'}
                      onClick={() => control('setSubState', { subState: 'story:1' })}
                    >
                      返回
                    </button>
                    <span className="story-hint">开场故事 · 大屏展示中，翻页引导</span>
                  </div>
                ) : null}
                {currentModuleId === 'A02_MIRROR' ? (
                  <div className="story-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="secondary"
                      disabled={busy || status === 'closed' || (summary?.moduleSubState ?? 'mirror:1') === 'mirror:1'}
                      onClick={() => {
                        const cur = parseInt(String(summary?.moduleSubState ?? 'mirror:1').replace('mirror:', ''), 10) || 1;
                        control('setSubState', { subState: `mirror:${Math.max(1, cur - 1)}` });
                      }}
                    >
                      上页
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || status === 'closed' || (summary?.moduleSubState ?? 'mirror:1') === 'mirror:3'}
                      onClick={() => {
                        const cur = parseInt(String(summary?.moduleSubState ?? 'mirror:1').replace('mirror:', ''), 10) || 1;
                        control('setSubState', { subState: `mirror:${Math.min(3, cur + 1)}` });
                      }}
                    >
                      下页
                    </button>
                    <span className="story-hint">大屏共 3 屏，翻页引导</span>
                  </div>
                ) : null}
                <button disabled={busy || status === 'closed'} onClick={() => control('advance')}>
                  {isA0 && typeof summary?.moduleSubState === 'string' && summary.moduleSubState.startsWith('story') ? '下一步 → 进入测评' : '下一环节 →'}
                </button>
                <button className="secondary" disabled={busy || status === 'closed'} onClick={() => control('lock', { locked: !moduleLocked })}>
                  {isA0New ? (moduleLocked ? '解锁' : '锁定') : isA0 ? (moduleLocked ? '恢复标签（解锁）' : '揭晓全班标签') : currentModuleId === 'A03_REDO' ? (moduleLocked ? '解锁提交' : '暂停 / 锁定提交') : (moduleLocked ? '解锁' : '锁定')}
                </button>
                {currentModuleId === 'A03_REDO' ? (
                  <button className="primary" disabled={busy || status === 'closed' || summary?.moduleSubState === 'compare'} onClick={() => control('setSubState', { subState: 'compare' })}>
                    {summary?.moduleSubState === 'compare' ? '已揭晓（再次揭晓）' : '揭晓前后变化'}
                  </button>
                ) : null}
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('确定重置课堂吗？将清空所有学生信息、答题记录和邀请码，回到等待开始状态。')) {
                      control('reset');
                    }
                  }}
                >
                  重置课堂
                </button>
              </>
            )}
            {!isA0New && (
              <button
                className="danger"
                disabled={busy || status === 'closed'}
                onClick={() => {
                  if (window.confirm('确定关闭本课堂吗？将释放所有学生并结束本场，之后可创建新课堂（新课堂码与之前互不影响）。')) {
                    control('close');
                  }
                }}
              >
                关闭课堂
              </button>
            )}
          </div>
          {isA0 ? (
            <p className="note" style={{ marginTop: 12, color: 'var(--yellow)' }}>
              学生答得差不多时，点上方「揭晓全班标签」，大屏将黑场后显示三类 AI 标签的人数与占比（路人 / 搭子 / 合伙人）。若想让学生继续补充，再点「恢复标签（解锁）」即可。
            </p>
          ) : null}
          {currentModuleId === 'A03_REDO' ? (
            <p className="note" style={{ marginTop: 12, color: 'var(--yellow)' }}>
              学生第二轮提交差不多时，先点「暂停 / 锁定提交」收齐，再点「揭晓前后变化」，大屏将显示第一轮基线 → 第二轮 在“对象 / 任务 / 过程 / 检验”上的前后变化与路径迁移。
            </p>
          ) : null}
          </>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>双屏预览</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/student?code=${inviteCode || ''}`} target="_blank" rel="noreferrer">
                <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }}>学生端 ↗</button>
              </a>
              <a href={`/screen?sessionId=${sessionId || ''}`} target="_blank" rel="noreferrer">
                <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }}>大屏 ↗</button>
              </a>
            </div>
          </div>
          {/* 大屏预览 */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>大屏（投屏显示）</div>
            <PreviewIframe src={`/screen?sessionId=${sessionId || ''}&preview=1`} title="大屏预览" maxWidth={600} />
          </div>
          {/* 学生端预览 */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>学生端（手机工作台）</div>
            <PreviewIframe src={`/student?code=${inviteCode || ''}`} title="学生端预览" maxWidth={380} />
          </div>
        </div>
      </div>

      {/* ===== 课堂诊断（所有模块垂直堆叠，新模块在上） ===== */}
      <div className="container">
        <div className="card cockpit">
          <div className="cockpit-head" style={{ cursor: 'pointer' }} onClick={() => setDiagOpen(!diagOpen)}>
            <h3 style={{ margin: 0 }}>课堂诊断 · 全部环节 {diagOpen ? '▾' : '▸'}</h3>
            <span className="pill blue">{diagOpen ? '点击收起历史' : '点击展开历史'}</span>
          </div>

          {/* 全局概览：始终可见 */}
          <div className="sales-strip">
            <div className="sales-title">📊 全场总览</div>
            <div className="sales-metrics">
              <div><b>{summary?.onlineStudents ?? 0}/{summary?.totalStudents ?? 0}</b><span>签到在线</span></div>
              <div><b>{summary?.totalSubmitted ?? 0}</b><span>累计提交</span></div>
            </div>
            <button className="mini-btn share-btn" onClick={copyShare}>{copiedShare ? '已复制 ✓' : '复制分享文案（转发销售/家长）'}</button>
          </div>

          {/* 每个模块一张卡片：当前环节在最顶，已完成按顺序往下排，未开始的环节不显示 */}
          {diagOpen && (
          <div className="module-stack">
            {modules
              .filter((mm) => {
                const isActive = mm.id === currentModuleId;
                const hist = moduleHistory[mm.id];
                return isActive || !!hist;
              })
              .sort((a, b) => {
                const aActive = a.id === currentModuleId ? 0 : 1;
                const bActive = b.id === currentModuleId ? 0 : 1;
                if (aActive !== bActive) return aActive - bActive;
                return modules.findIndex((m) => m.id === a.id) - modules.findIndex((m) => m.id === b.id);
              })
              .map((mm) => {
                const isActive = mm.id === currentModuleId;
                const hist = moduleHistory[mm.id];
                const isA0Card = mm.id === 'A0_SCREENING';

                return (
                  <div key={mm.id} className={`module-card ${isActive ? 'active' : ''}`}>
                    <div className="module-card-head">
                      <span className="module-card-title">{mm.id} · {mm.title}</span>
                      {isActive && <span className="pill green">进行中</span>}
                      {!isActive && hist && <span className="pill gray">已完成</span>}
                    </div>

                    {isActive && !hist ? (
                      <p className="hint" style={{ padding: '12px 16px' }}>等待进入此环节…</p>
                    ) : isActive && hist ? (
                      <p className="hint" style={{ padding: '12px 16px' }}>此环节进行中，数据随回答实时更新</p>
                    ) : null}
                    {hist && (isA0Card && hist.type === 'a0' ? renderA0Card(hist.data) : hist.type === 'a0n' ? renderA0NCard(hist.data) : hist.type === 'a1' ? renderA1Card(hist.data) : hist.type === 'normal' ? renderNormalCard(hist.data) : null)}
                  </div>
                );
              })}
          </div>
          )}
        </div>
      </div>

      {showMedia && <MediaManager onClose={() => setShowMedia(false)} />}

      {editingPageId && <ContentPageEditor pageId={editingPageId} onClose={() => setEditingPageId(null)} />}

      {editingBuiltin && (
        <BuiltinTextEditor
          page={editingBuiltin}
          onClose={() => setEditingBuiltin(null)}
          onSaved={() => setEditingBuiltin(null)}
        />
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>AI 模型设置</h3>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
              填入 DeepSeek API Key 后，学生端的 AI 回复会立即切换到真实模型。Key 会保存在本机 .env.local 中，仅当前进程使用。
            </p>

            <div className="form-row">
              <label>当前状态</label>
              <div>
                {llmStatus?.configured ? (
                  <span className="pill green">已配置 · {llmStatus.maskedKey}</span>
                ) : (
                  <span className="pill yellow">未配置，当前使用离线 mock</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <label>DeepSeek API Key</label>
              <input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>

            <div className="form-row">
              <label>API Base URL</label>
              <input
                type="text"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
              />
            </div>

            <div className="form-row">
              <label>模型名称</label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="deepseek-chat"
              />
            </div>

            <div className="modal-actions">
              {llmStatus?.configured && (
                <button
                  className="secondary"
                  onClick={() => saveSettings(true)}
                  disabled={settingsBusy}
                  style={{ marginRight: 'auto' }}
                >
                  恢复离线 mock
                </button>
              )}
              <button className="secondary" onClick={() => setSettingsOpen(false)} disabled={settingsBusy}>取消</button>
              <button onClick={() => saveSettings(false)} disabled={settingsBusy || !llmKey.trim()}>
                {settingsBusy ? '保存中…' : '保存并生效'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showThoughts && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowThoughts(false); }}>
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <h3>学生的 AI 认知想法</h3>
              <button className="modal-close" onClick={() => setShowThoughts(false)}>×</button>
            </div>
            <div style={{ padding: '4px 0 16px', fontSize: 13, color: 'var(--muted)' }}>
              共 {thoughts.length} 条（匿名，按时间倒序）。开课前可在大屏引用。
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {thoughts.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 14, padding: 16 }}>还没有学生发送想法。</p>
              ) : (
                thoughts.map((t) => (
                  <div key={t.id} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: 'rgba(15,23,42,0.4)' }}>
                    <div style={{ fontSize: 15, color: '#e2e8f0', lineHeight: 1.6 }}>“{t.text}”</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      {t.anonymousId} · {t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 《我的世界》大屏环境光斑整体速度/亮度调节（教师调整体，不是单个）
// 环节视频控制条：教师端环节页下的播放/暂停/停止（广播到真正大屏；预览与大屏不冲突）
function VideoControlBar({
  title,
  url,
  control,
  busy,
}: {
  title: string;
  url?: string;
  control: (action: string, payload?: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const btn: React.CSSProperties = {
    fontSize: 12, padding: '5px 14px', borderRadius: 999, border: '1px solid #334155',
    background: 'var(--card)', color: 'var(--fg)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  };
  return (
    <div style={{ border: '1px solid rgba(251,146,60,0.45)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>🎬 {title}</span>
      <button style={{ ...btn, background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)', color: '#86efac' }} disabled={busy} onClick={() => control('playVideo', { action: 'play', url })}>
        ▶ 播放
      </button>
      <button style={{ ...btn, background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.45)', color: '#fde68a' }} disabled={busy} onClick={() => control('playVideo', { action: 'pause', url })}>
        ⏸ 暂停
      </button>
      <button style={{ ...btn, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }} disabled={busy} onClick={() => control('playVideo', { action: 'stop', url })}>
        ⏹ 停止
      </button>
    </div>
  );
}

function WorldVisualBar() {
  const [speed, setSpeed] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/world/visual', { cache: 'no-store' });
      const d = await r.json();
      setSpeed(Number(d.speed) || 1);
      setBrightness(Number(d.brightness) || 1);
    } catch { /* noop */ }
  }

  useEffect(() => { load(); }, []);

  async function apply(s: number, b: number) {
    setSpeed(s);
    setBrightness(b);
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/world/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: s, brightness: b }),
      });
    } finally {
      setTimeout(() => setBusy(false), 300);
    }
  }

  return (
    <div style={{ border: '1px solid rgba(56,189,248,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>环境光斑（整体）</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', width: 34, flexShrink: 0 }}>速度</span>
        <input type="range" min={0.3} max={3} step={0.1} value={speed} onChange={(e) => apply(Number(e.target.value), brightness)} style={{ flex: 1 }} />
        <span style={{ fontSize: 11, width: 36, textAlign: 'right' }}>{speed.toFixed(1)}×</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', width: 34, flexShrink: 0 }}>亮度</span>
        <input type="range" min={0.3} max={3} step={0.1} value={brightness} onChange={(e) => apply(speed, Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 11, width: 36, textAlign: 'right' }}>{brightness.toFixed(1)}×</span>
      </div>
    </div>
  );
}

// 《我的世界》预置生命：教师端一键添加演示生命进世界（多卡片，点哪个注入哪个）
function WorldPresetBar() {
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, number>>({});

  async function addPreset(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/world/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: id }),
      });
      const d = await res.json();
      if (res.ok && d.life) {
        setAdded((a) => ({ ...a, [id]: (a[id] || 0) + 1 }));
      } else {
        alert('添加失败：' + (d.error?.message || res.statusText));
      }
    } finally {
      setTimeout(() => setBusy(null), 300);
    }
  }

  return (
    <div style={{ border: '1px solid rgba(124,58,237,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>预置生命（点一下注入世界做例子）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {LIFE_PRESETS.map((p) => (
          <div
            key={p.id}
            style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 8, width: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            {p.shape ? (
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(p.shape)}`} width={56} height={56} alt={p.name} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: p.color, opacity: 0.6 }} />
            )}
            <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
            {p.desc ? <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>{p.desc}</div> : null}
            <button className="secondary" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--green)' }} disabled={busy === p.id} onClick={() => addPreset(p.id)}>
              {busy === p.id ? '注入中…' : '➕ 注入'}
            </button>
            {added[p.id] ? <span className="pill green" style={{ fontSize: 10 }}>已注入 {added[p.id]} 个</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// 《我的世界》Tips 发布控件：8 条课堂任务，老师按序/按需点哪条，大屏就弹哪条
function WorldTipsBar() {
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/world/popup', { cache: 'no-store' });
      const d = await r.json();
      if (d.show) setActive(d.content ?? null);
      else setActive(null);
    } catch { /* noop */ }
  }

  useEffect(() => { load(); }, []);

  async function show(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/world/popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: id, show: true }),
      });
      setActive(id);
    } finally {
      setTimeout(() => setBusy(false), 200);
    }
  }

  async function hide() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/world/popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: null, show: false }),
      });
      setActive(null);
    } finally {
      setTimeout(() => setBusy(false), 200);
    }
  }

  const TIPS = [
    { id: 'tip01', label: '01 造一个生命' },
    { id: 'tip02', label: '02 给它一点感觉' },
    { id: 'tip03', label: '03 让AI实现想法' },
    { id: 'tip04', label: '04 放进世界观察' },
    { id: 'tip05', label: '05 发现问题' },
    { id: 'tip06', label: '06 让AI看看' },
    { id: 'tip07', label: '07 只改一个地方' },
    { id: 'tip08', label: '08 自由创造' },
  ];

  return (
    <div style={{ border: '1px solid rgba(251,191,36,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>发布 Tips</span>
        {active && <span className="pill blue" style={{ fontSize: 10 }}>大屏显示中</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TIPS.map((t) => (
          <button key={t.id} className="secondary" style={{ fontSize: 11, padding: '4px 9px', color: active === t.id ? 'var(--green)' : undefined }}
            disabled={busy} onClick={() => show(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="secondary" style={{ fontSize: 11, padding: '4px 9px' }} disabled={busy || !active} onClick={hide}>收起</button>
      </div>
    </div>
  );
}

// 收官 · 四翼展示控制条：教师端逐步点亮四翼（wings:0 开场 → 1 创造 → 2 驾驭 → 3 成长 → 4 传播 → 5 成长链）
function FourWingsTeacherBar({
  subState,
  busy,
  control,
}: {
  subState: string | null;
  busy: boolean;
  control: (action: string, payload?: any) => void;
}) {
  const cur = (() => {
    const m = String(subState ?? '').match(/(?:^|:)wings:(\d+)$/);
    return m ? Math.max(0, Math.min(5, parseInt(m[1], 10))) : 0;
  })();
  const WINGS = [
    { n: 0, label: '开场' },
    { n: 1, label: '① 创造' },
    { n: 2, label: '② 驾驭' },
    { n: 3, label: '③ 成长' },
    { n: 4, label: '④ 传播' },
    { n: 5, label: '成长链' },
  ];
  return (
    <div style={{ border: '1px solid rgba(63,208,201,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>四翼展示 · 逐步点亮（大屏动画随按钮推进）</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {WINGS.map((w) => (
          <button
            key={w.n}
            className={cur === w.n ? 'primary' : 'secondary'}
            style={{ fontSize: 11, padding: '4px 10px' }}
            disabled={busy}
            onClick={() => control('setSubState', { subState: `closing:wings:${w.n}` })}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 收官 · 痛点墙控制条：教师端逐张点亮痛点（pain:0 全灭 → 1..8 逐张点亮）
function PainWallTeacherBar({
  subState,
  busy,
  control,
}: {
  subState: string | null;
  busy: boolean;
  control: (action: string, payload?: any) => void;
}) {
  const cur = (() => {
    const m = String(subState ?? '').match(/(?:^|:)pain:(\d+)$/);
    return m ? Math.max(0, Math.min(8, parseInt(m[1], 10))) : 0;
  })();
  const go = (n: number) => control('setSubState', { subState: `closing:pain:${n}` });
  return (
    <div style={{ border: '1px solid rgba(96,165,250,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>痛点墙 · 逐张点亮（AI坑 ↔ 我们自己的坑）</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy || cur <= 0} onClick={() => go(Math.max(0, cur - 1))}>◀ 上一张</button>
        <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy || cur >= 8} onClick={() => go(Math.min(8, cur + 1))}>下一张 ▶</button>
        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 64, textAlign: 'center' }}>{cur} / 8</span>
        <button className={cur === 8 ? 'primary' : 'secondary'} style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy} onClick={() => go(8)}>全部点亮</button>
      </div>
    </div>
  );
}

// 收官 · 价格颁布控制条：教师端逐步推进（closing:price:0..6）
function PriceRevealTeacherBar({
  subState,
  busy,
  control,
}: {
  subState: string | null;
  busy: boolean;
  control: (action: string, payload?: any) => void;
}) {
  const cur = (() => {
    const m = String(subState ?? '').match(/(?:^|:)price:(\d+)$/);
    return m ? Math.max(0, Math.min(21, parseInt(m[1], 10))) : 0;
  })();
  const STEPS = [
    { n: 0, label: '值多少' },
    { n: 1, label: '¥39 小课' },
    { n: 2, label: '¥3,300-9,800' },
    { n: 3, label: '转折' },
    { n: 4, label: '悬念 ???' },
    { n: 5, label: '¥299 揭晓' },
    { n: 6, label: '三样价值' },
    { n: 21, label: '立即报名' },
  ];
  const go = (n: number) => control('setSubState', { subState: `closing:price:${n}` });
  return (
    <div style={{ border: '1px solid rgba(251,191,36,0.4)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>价格颁布 · 逐步推进（锚点 → 悬念 → ¥299 → 三样价值逐列垒 → 报名）</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy || cur <= 0} onClick={() => go(Math.max(0, cur - 1))}>◀ 上一步</button>
        <button className="secondary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busy || cur >= 21} onClick={() => go(Math.min(21, cur + 1))}>下一步 ▶</button>
        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 56, textAlign: 'center' }}>{cur} / 21</span>
        {STEPS.map((s) => (
          <button
            key={s.n}
            className={cur === s.n ? 'primary' : 'secondary'}
            style={{ fontSize: 11, padding: '4px 8px' }}
            disabled={busy}
            onClick={() => go(s.n)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
