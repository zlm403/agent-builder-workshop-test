'use client';

import { useEffect, useRef, useState } from 'react';
import { getStyleProfile } from '@/lib/styleProfiles';
import { A1_REVIEW } from '@/lib/a1Review';
import StudentFinale from '@/components/StudentFinale';
import ClosingStudent from '@/components/ClosingStudent';
import StudentWaitingRoom from '@/components/StudentWaitingRoom';
import VocabBrowser from '@/components/VocabBrowser';
import L2StudentFlow from './L2StudentFlow';
import AvatarA0Student from '@/components/AvatarA0Student';
import AvatarA1Student from '@/components/AvatarA1Student';
import GrowGameStudent from '@/components/GrowGameStudent';

interface ModuleDef {
  id: string;
  title: string;
  type: string;
  screenContent?: Record<string, any>;
  studentTask?: {
    prompt?: string;
    options?: { id: string; label: string }[];
    fields?: { key: string; label: string; required?: boolean }[];
    allowPaste?: boolean;
    allowExample?: boolean;
    ruleSections?: { key: string; label: string; desc: string }[];
    workflowSteps?: string[];
    personas?: { id: string; name: string; corpus: string; note: string }[];
    coreExample?: string;
    scenario?: string;
  };
  teacherContent?: Record<string, any>;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

// AI 标签三类展示文案（与筛查引擎一致）
const LABEL_TEXT: Record<string, string> = {
  tool_user: 'AI 路人',
  task_solver: 'AI 搭子',
  app_creator: 'AI 合伙人',
};

export default function StudentPage() {
  const [code, setCode] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [nickname, setNickname] = useState(''); // 学生自己填的昵称（无微信授权时的身份标识）
  const [wechatName, setWechatName] = useState(''); // 微信扫码自动识别的昵称
  const [phase, setPhase] = useState<'loading' | 'join' | 'class' | 'finale'>('loading');
  const [closingActive, setClosingActive] = useState(false);
  const [closingBeat, setClosingBeat] = useState(0);
  const [anonymousId, setAnonymousId] = useState('');
  const [current, setCurrent] = useState<ModuleDef | null>(null);
  const [moduleStatus, setModuleStatus] = useState('pending');
  const [locked, setLocked] = useState(false);
  const [subState, setSubState] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // 模块进度被教师重置时 ++ 强制重挂载

  // 连接建立即拉取收官状态：SSE 不回放历史事件，学生端若晚于 enter 连上需自愈
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/closing/state?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.active) setClosingActive(true);
        if (typeof d?.beatIdx === 'number') setClosingBeat(d.beatIdx);
      })
      .catch(() => {});
  }, [sessionId]);

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [vocabAttached, setVocabAttached] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const connectRef = useRef<(() => void) | null>(null);
  const refreshRef = useRef<(anonId?: string) => void>(() => {});
  const vocabIncludedRef = useRef(false);

  // A01 工作区状态
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [finalText, setFinalText] = useState('');
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  // A0 环节：AI 标签（一个主问题 + 一次针对性追问）
  const [screeningAnswer, setScreeningAnswer] = useState('');
  const [screeningFollowupAnswer, setScreeningFollowupAnswer] = useState('');
  const [screeningFollowupText, setScreeningFollowupText] = useState('');
  const [screeningResult, setScreeningResult] = useState<Record<string, any> | null>(null);
  const [screeningStep, setScreeningStep] = useState<'q1' | 'reading' | 'q2' | 'done'>('q1');
  const [screeningReveal, setScreeningReveal] = useState(false);
  const [myStyle, setMyStyle] = useState<string | null>(null); // 学员在 A01 的实操分类（一次性/多轮/流程），驱动 A02/A03 个性化内容

  // Part 2 运行态（A08 运行 / A09 压力测试 / A10 对比）
  const [runOutput, setRunOutput] = useState('');
  const [runSteps, setRunSteps] = useState<string[]>([]);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState('');

  const isAiTask = current?.type === 'ai_task';
  const sp = getStyleProfile(myStyle); // 学员实操分类画像（A02/A03 个性化内容）
  const cfg = (current?.teacherContent ?? {}) as {
    prompt?: string;
    originalPrompt?: string;
    requirements?: string[];
    materials?: { id: string; title: string; body: string; kind?: string }[];
    timeLimitSec?: number;
    taskArea?: { targetUser: string; goal: string; available: string; finalDeliverable: string };
  };

  // 二维码进入：?code=INVITE —— 微信扫码授权后会带回 wxName；普通扫码无 wxName
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    const wx = params.get('wxName');
    const savedToken = localStorage.getItem('studentResumeToken');
    if (c) {
      const code = c.toUpperCase();
      setCode(code);
      if (wx) {
        setWechatName(decodeURIComponent(wx));
        setNickname(decodeURIComponent(wx)); // 有微信昵称时作为默认昵称
      }
      // 扫了新课堂的码：仅当旧 token 属于同一课堂才直接恢复，否则清掉旧 token 重新报名
      if (savedToken) {
        resumeForCode(savedToken, code);
      } else {
        // 没有旧 token：学生需要填个人邀请码报名
        setPhase('join');
      }
      return;
    }
    if (savedToken) {
      doResume(savedToken);
    } else {
      // 没扫码、没旧 token：显示加入页
      setPhase('join');
    }
  }, []);

  // 实时跟随教师（带断线重连）
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
          if (evt.type === 'module:advanced' || evt.type === 'module:locked' || evt.type === 'module:substate') {
            refreshCurrent();
          } else if (evt.type === 'module:reset') {
            // 教师重置了某模块进度：刷新状态并强制重挂载当前模块组件，回到初始
            refreshCurrent();
            setReloadKey((k) => k + 1);
          } else if (evt.type === 'classroom:reset') {
            // 课堂被重置：清除本地恢复凭证 + 所有标签状态，回到"加入课堂"
            localStorage.removeItem('studentResumeToken');
            setAnonymousId('');
            setSessionId('');
            setPhase('join');
            setScreeningStep('q1');
            setScreeningResult(null);
            setScreeningAnswer('');
            setScreeningFollowupAnswer('');
            setBusy(false);
          } else if (evt.type === 'classroom:closed') {
            // 课堂被关闭：释放学生，回到"加入课堂"
            localStorage.removeItem('studentResumeToken');
            setAnonymousId('');
            setSessionId('');
            setPhase('join');
            setScreeningStep('q1');
            setScreeningResult(null);
            setScreeningAnswer('');
            setScreeningFollowupAnswer('');
            setBusy(false);
            setMessage('本课堂已关闭，学生已释放。如需重新上课，请使用新的课堂码进入。');
          } else if (evt.type === 'finale:enter') {
            setPhase('finale');
          } else if (evt.type === 'finale:exit') {
            setPhase('class');
            refreshCurrent();
          } else if (evt.type === 'closing:enter') {
            setClosingActive(true);
          } else if (evt.type === 'closing:exit') {
            setClosingActive(false);
          } else if (evt.type === 'closing:beat') {
            const b = (evt.payload as { beatIdx?: number })?.beatIdx;
            if (typeof b === 'number') setClosingBeat(b);
          }
        } catch {
          /* noop */
        }
      };
      es.onopen = () => {
        // 重连成功后主动追平一次最新状态，避免错过后台期间的推送
        refreshRef.current();
      };
      es.onerror = () => {
        console.warn('SSE error, reconnecting...');
        es.close();
        retryTimer = setTimeout(connect, 3000);
      };
    }
    connectRef.current = connect;
    connect();
    return () => {
      closed = true;
      connectRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, [sessionId]);

  // 页面从后台切回前台时主动追平最新状态（手机切走再回来不会错过推送）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (anonymousId) refreshRef.current();
        // SSE 若已断开，复用带事件处理的 connect 重连（避免新建无回调连接导致推送全丢）
        if (sessionId && (!esRef.current || esRef.current.readyState === EventSource.CLOSED)) {
          esRef.current?.close();
          connectRef.current?.();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [anonymousId, sessionId]);

  // A01 倒计时：基于老师推进到本环节的真实时刻计算剩余，迟到/二次进入自动跟随
  useEffect(() => {
    if (!isAiTask || !cfg.timeLimitSec) return;
    const deadline = startedAt ? new Date(startedAt).getTime() + cfg.timeLimitSec * 1000 : null;
    if (deadline) {
      const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }
    setRemaining(cfg.timeLimitSec);
    const t = setInterval(() => setRemaining((r) => (r && r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [isAiTask, cfg.timeLimitSec, current?.id, startedAt]);

  // A0 开始时的"准备"小仪式：进入 hr_screening 后短暂展示"你的标签正在生成"，再揭晓问题
  useEffect(() => {
    if (current?.type === 'hr_screening' && !screeningResult) {
      setScreeningReveal(false);
      const t = setTimeout(() => setScreeningReveal(true), 1000);
      return () => clearTimeout(t);
    }
    setScreeningReveal(false);
  }, [current?.type, current?.id, screeningResult]);

  async function doResume(token: string) {
    const res = await fetch('/api/student/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeToken: token }),
    });
    if (!res.ok) {
      // resume 失败（token 失效/课堂已重置）：清掉旧 token，显示加入页
      localStorage.removeItem('studentResumeToken');
      setPhase('join');
      return;
    }
    const data = await res.json();
    setAnonymousId(data.anonymousId);
    setSessionId(data.sessionId);
    setPhase('class');
    refreshCurrent(data.anonymousId);
  }

  // 扫码进入：用旧 token 尝试恢复，但仅当 token 属于当前课堂才恢复，否则清掉重新报名
  async function resumeForCode(token: string, code: string) {
    const res = await fetch('/api/student/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeToken: token }),
    });
    if (!res.ok) {
      setPhase('join');
      return;
    }
    const data = await res.json();
    if (data.inviteCode && data.inviteCode !== code) {
      // 旧 token 属于另一个课堂，清掉并重新报名当前课堂
      localStorage.removeItem('studentResumeToken');
      setPhase('join');
      return;
    }
    // 同一课堂：直接恢复并跳到当前正在进行的环节
    setAnonymousId(data.anonymousId);
    setSessionId(data.sessionId);
    setPhase('class');
    refreshCurrent(data.anonymousId);
  }

  async function join(codeOverride?: string, invitationCodeOverride?: string) {
    const useCode = codeOverride ?? code;
    const useInvitation = invitationCodeOverride ?? invitationCode;
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/student/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: useCode,
        invitationCode: useInvitation,
        nickname: nickname || wechatName || undefined,
        wechatName: wechatName || undefined,
        deviceInfo: { ua: navigator.userAgent },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      const err = data.error?.code;
      setMessage(
        err === 'INVALID_CODE' ? '课堂码无效' :
        err === 'SESSION_CLOSED' ? '本课堂已关闭，无法进入' :
        err === 'INVITATION_REQUIRED' ? '请输入个人邀请码' :
        err === 'INVALID_INVITATION' ? '个人邀请码无效（请确认课堂码与本邀请码同属一个课堂）' :
        err === 'INVITATION_USED' ? '该邀请码已被使用' :
        '进入失败'
      );
      return;
    }
    localStorage.setItem('studentResumeToken', data.resumeToken);
    setAnonymousId(data.anonymousId);
    setSessionId(data.sessionId);
    setPhase('class');
    refreshCurrent(data.anonymousId);
  }

  async function refreshCurrent(anonId?: string) {
    const id = anonId ?? anonymousId;
    if (!id) return;
    try {
      const res = await fetch(`/api/student/${id}`);
      if (!res.ok) {
        // participant 已被删除（重置/关闭），清除本地状态回到加入页
        localStorage.removeItem('studentResumeToken');
        setAnonymousId('');
        setSessionId('');
        setPhase('join');
        return;
      }
      const data = await res.json();
      setCurrent(data.currentModule);
      setModuleStatus(data.currentModuleStatus);
      setLocked(data.moduleLocked);
      setSubState(data.moduleSubState ?? null);
      if (data.moduleStartedAt) setStartedAt(data.moduleStartedAt);
      if (data.currentModuleData) setForm(data.currentModuleData);
      const md = data.currentModuleData as any;
      // 防护：仅当模块状态为 submitted/completed 时才恢复标签数据
      // 避免重置后残留的旧 progress.data 被当成当前数据渲染
      const hasActiveProgress = data.currentModuleStatus === 'submitted' || data.currentModuleStatus === 'completed';
      if (hasActiveProgress && md?.screening) setScreeningResult(md.screening);
      if (hasActiveProgress && md?.followup) {
        setScreeningFollowupText(md.followup.text ?? '');
        setScreeningFollowupAnswer(md.followup.answer ?? '');
      }
      if (hasActiveProgress && md?.finalJudgment) {
        setScreeningResult(md.finalJudgment);
        setScreeningStep('done');
      } else if (hasActiveProgress && md?.followup) {
        setScreeningStep('q2');
      } else {
        // 无有效进度时，始终从 q1 开始（不渲染旧反馈卡）
        setScreeningStep('q1');
      }
      setMyStyle(data.aiStyle ?? null);
      // 教师进入终章后自动切到体验；终章复位（退回其它环节）后主动退出，避免学生端卡死在 A07
      if (data.finale?.active && phase !== 'finale') setPhase('finale');
      else if (!data.finale?.active && phase === 'finale') setPhase('class');
    } catch {
      // 网络错误等静默忽略，下次 visibilitychange/onopen 会重试
    }
  }
  // 始终用最新的 refreshCurrent（避免 visibilitychange/onopen 里拿到旧闭包）
  refreshRef.current = refreshCurrent;

  function sendVocabToAI() {
    setVocabAttached(true);
    setShowVocab(false);
  }

  async function sendChat() {
    const text = input.trim();
    if (!text || busy || locked) return;
    setBusy(true);
    setInput('');
    const attachVocab = vocabAttached && !vocabIncludedRef.current;
    if (attachVocab) vocabIncludedRef.current = true;
    setTurns((t) => [...t, { role: 'user', content: text }]);
    try {
      const res = await fetch(`/api/student/${anonymousId}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, materialReferenced: attachVocab, attachVocab }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        const err = d.error?.message || d.error || 'AI 服务暂时不可用';
        setTurns((t) => [
          ...t,
          { role: 'assistant', content: `[系统提示] ${err}。请检查教师端"设置"里的 API Key 是否正确，或稍后再试。` },
        ]);
      } else {
        if (d.reply) setTurns((t) => [...t, { role: 'assistant', content: d.reply }]);
        if (d.profile) setProfile(d.profile);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitTask() {
    setBusy(true);
    setMessage('');
    const res = await fetch(`/api/student/${anonymousId}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submit: true, finalText }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(d.error?.code === 'MODULE_LOCKED' ? '当前环节已锁定' : '提交失败');
      return;
    }
    if (d.profile) setProfile(d.profile);
    setModuleStatus('submitted');
    setMessage('已提交。稍后老师会结合全班的操作方式，说明一次性问答和 Agent 式任务设计有什么不同。');
  }

  async function submit() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/module/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, moduleId: current?.id, data: form }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setMessage(d.error?.code === 'MODULE_LOCKED' ? '当前环节已锁定' : '提交失败');
      return;
    }
    setModuleStatus('submitted');
    setMessage('已提交，等待教师推进到下一环节。');
  }

  async function runAgent(scenario: 'normal' | 'stress') {
    if (runLoading || locked) return;
    setRunLoading(true);
    setRunError('');
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, scenario }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setRunError(d.error?.message || '运行失败，请检查教师端"设置"里是否已配置 API Key');
        return;
      }
      setRunOutput(d.output || '');
      setRunSteps(d.steps || []);
      setForm((f) => ({ ...f, output: d.output, scenario, steps: d.steps }));
      // 为 A10 对比缓存到本地（按场景区分）
      try {
        localStorage.setItem(
          scenario === 'stress' ? 'part2_run_stress' : 'part2_run_normal',
          JSON.stringify(d),
        );
      } catch {
        /* noop */
      }
    } finally {
      setRunLoading(false);
    }
  }

  async function submitScreeningQ1() {
    const answer = screeningAnswer.trim();
    if (!answer || busy || locked) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/screening/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, answer }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error?.code === 'MODULE_LOCKED' ? '本环节已截止' : '提交失败');
        return;
      }
      setScreeningResult(d);
      setScreeningFollowupText(d.followup?.text ?? '能不能再补充一点：你具体做了什么、产生了什么结果？');
      setScreeningStep('reading');
      setTimeout(() => setScreeningStep('q2'), 1200);
    } finally {
      setBusy(false);
    }
  }

  async function submitScreeningQ2() {
    const answer = screeningFollowupAnswer.trim();
    if (!answer || busy || locked) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/screening/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, followupAnswer: answer }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error?.code === 'MODULE_LOCKED' ? '本环节已截止' : '提交失败');
        return;
      }
      setScreeningResult(d);
      setScreeningStep('done');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="container" style={{ maxWidth: 480, textAlign: 'center', paddingTop: '30vh' }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>加载中…</div>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>正在恢复你的课堂进度</div>
      </div>
    );
  }

  if (phase === 'join') {
    return (
      <div className="container" style={{ maxWidth: 480 }}>
        <h1>进入课堂</h1>
        <div className="welcome-banner">
          <div style={{ fontSize: 40 }}>🤖</div>
          <h2 style={{ margin: '8px 0' }}>AI 互动体验课</h2>
          <p className="note">扫码后输入你的个人邀请码即可入场。入场后请保持手机打开，准备参与实时环节。</p>
        </div>
        <div className="card">
          {wechatName ? (
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(168,85,247,0.12)', borderRadius: 10, fontSize: 14 }}>
              ✅ 已自动识别微信昵称：<b>{wechatName}</b>（将作为你的身份标识，仅用于课后顾问跟进）
            </div>
          ) : null}
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>课堂码</label>
          <input placeholder="如 HEPK3F" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <label style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>你的个人邀请码</label>
          <input placeholder="如 AB12CD34" value={invitationCode} onChange={(e) => setInvitationCode(e.target.value.toUpperCase())} />
          <label style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>你的昵称</label>
          <input
            placeholder="给自己起个称呼，如：小林"
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
          />
          <p className="note" style={{ marginTop: 12 }}>
            昵称方便我们课后更好地回答你的问题，课堂讲解全程匿名。不填也可以，将用课堂编号代替。
          </p>
          <div style={{ height: 12 }} />
          <button disabled={busy || !code || !invitationCode} onClick={() => join()}>
            {busy ? '进入中…' : '进入课堂'}
          </button>
          {message ? <p style={{ color: 'var(--red)' }}>{message}</p> : null}
        </div>
      </div>
    );
  }

  if (closingActive) {
    return (
      <ClosingStudent
        key={sessionId}
        beatIdx={closingBeat}
        sessionId={sessionId}
        anon={anonymousId || undefined}
      />
    );
  }

  if (phase === 'finale' || current?.type === 'finale') {
    return (
      <div className="container" style={{ maxWidth: 880 }}>
        <StudentFinale locked={locked} />
      </div>
    );
  }

  if (current?.type === 'wrap_up') {
    return (
      <div className="container" style={{ maxWidth: 480, textAlign: 'center', paddingTop: '24vh' }}>
        <div style={{ fontSize: 56, marginBottom: 18 }}>👀</div>
        <h2 style={{ fontSize: 28, marginBottom: 10 }}>请看大屏</h2>
        <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7 }}>
          老师正在做一期收尾讲解。<br />
          听完之后，等下一期开始。
        </p>
        <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', color: 'var(--blue)', fontSize: 14 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--blue)' }} />
          等待下一期…
        </div>
      </div>
    );
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      {!current || current.type === 'waiting' ? (
        <StudentWaitingRoom anonymousId={anonymousId} sessionId={sessionId} />
      ) : current.type === 'hr_screening' && typeof subState === 'string' && subState.startsWith('story') ? (
        <StudentStoryWait />
      ) : typeof subState === 'string' && subState.startsWith('page:') ? (
        <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
          <p className="note">老师正在展示这一页，跟着大屏一起看。</p>
        </div>
      ) : (
        <>
          <div className="status-bar">
            {current.type === 'hr_screening' ? (
              <div className="a0-idcorner">编号 {anonymousId}</div>
            ) : (
              <div><span className="label">编号</span>{anonymousId}</div>
            )}
            {isAiTask && remaining !== null ? <div><span className="label">剩余</span>{fmt(remaining)}</div> : null}
            <div style={{ marginLeft: 'auto' }}>
              {current.type === 'hr_screening' ? (
                <span className="pill blue">AI 标签 {screeningStep === 'q2' || screeningStep === 'done' ? '2' : '1'} / 2</span>
              ) : (
                <span className={`pill ${locked ? 'red' : 'green'}`}>{locked ? '已锁定' : '可操作'}</span>
              )}
            </div>
          </div>

          <div className="card">
            <>
              {current.type !== 'hr_screening' && <h2>{current.title}</h2>}

              {current.type === 'hr_screening' && (
              <div className="hr-screening">
                <div className="a0-h">
                  <div className="a0-eyebrow">顷悟 · AI 互动体验课</div>
                </div>

                {screeningStep === 'done' && screeningResult ? (
                  <div className="a0-feedback">
                    <div className="a0-fb-eyebrow">你的当前 AI 标签 · 基于本次回答</div>
                    <div className={`a0-fb-label k-${screeningResult.label}`}>{LABEL_TEXT[screeningResult.label] || screeningResult.label}</div>
                    <div className="a0-fb-section">
                      <div className="a0-fb-key">我们看到了</div>
                      <div className="a0-fb-val">{screeningResult.feedback?.heard}</div>
                    </div>
                    {screeningResult.feedback?.notHeard ? (
                      <div className="a0-fb-section">
                        <div className="a0-fb-key">还没看到</div>
                        <div className="a0-fb-val">{screeningResult.feedback.notHeard}</div>
                      </div>
                    ) : null}
                    <div className="a0-fb-section">
                      <div className="a0-fb-key">让标签更有说服力</div>
                      <div className="a0-fb-val">{screeningResult.feedback?.strengthen}</div>
                    </div>
                    <p className="a0-fb-foot">这是基于你这次回答的判断，不是对你全部 AI 能力的最终结论。</p>
                  </div>
                ) : screeningStep === 'reading' ? (
                  <div className="a0-reading">
                    <div className="a0-reading-1">正在解读你的回答……</div>
                    <div className="a0-dots"><i /><i /><i /></div>
                  </div>
                ) : screeningStep === 'q2' ? (
                  <div>
                    <p className="task-prompt a0-q2">{screeningFollowupText}</p>
                    <textarea
                      placeholder="例如：我用它做过……"
                      value={screeningFollowupAnswer}
                      disabled={locked}
                      onChange={(e) => setScreeningFollowupAnswer(e.target.value)}
                      style={{ minHeight: 130 }}
                    />
                    <button disabled={busy || locked || !screeningFollowupAnswer.trim()} onClick={submitScreeningQ2}>
                      {busy ? '提交中…' : '提交'}
                    </button>
                    {locked && <p className="note">本环节已截止。</p>}
                  </div>
                ) : !screeningReveal ? (
                  <div className="sw-ritual">
                    <div className="sw-ritual-1">正在生成你的 AI 标签</div>
                    <div className="sw-ritual-2">先想一想你和 AI 的故事…</div>
                  </div>
                ) : (
                  <div>
                    <p className="task-prompt a0-q1">{current.studentTask?.prompt}</p>
                    <textarea
                      placeholder="例如：我用 DeepSeek 写过年会发言稿…"
                      value={screeningAnswer}
                      disabled={locked}
                      onChange={(e) => setScreeningAnswer(e.target.value)}
                      style={{ minHeight: 180 }}
                    />
                    <button disabled={busy || locked || !screeningAnswer.trim()} onClick={submitScreeningQ1}>
                      {busy ? '提交中…' : '提交'}
                    </button>
                    {locked && <p className="note">本环节已截止。可留意大屏上的全班揭晓。</p>}
                  </div>
                )}
              </div>
            )}

            {current.type === 'a0_new' && (
              <AvatarA0Student
                type={current.id}
                anonymousId={anonymousId}
                sessionId={sessionId}
                locked={locked}
                moduleStatus={moduleStatus}
                submitted={moduleStatus === 'submitted'}
                onSubmitted={() => refreshRef.current()}
                currentTitle={current.title}
                subState={subState}
              />
            )}

            {current.type === 'avatar_flow' && (
              <AvatarA1Student key={reloadKey} anonymousId={anonymousId} sessionId={sessionId} locked={locked} subState={subState} />
            )}

            {current.type === 'site_entry' && (
              <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
                <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
                <p className="note">本环节待重建，跟着大屏。</p>
              </div>
            )}

            {current.type === 'grow_game' && (
              <GrowGameStudent anonymousId={anonymousId} sessionId={sessionId} locked={locked} subState={subState} />
            )}

            {isAiTask && (
              <div className="ai-workspace">
                <div className="zone task-zone">
                  <h3>任务区</h3>
                  {cfg.originalPrompt && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>第一轮任务（原文）</div>
                      <p className="task-prompt" style={{ color: '#cbd5e1' }}>{cfg.originalPrompt}</p>
                    </div>
                  )}
                  <div style={{ marginBottom: cfg.originalPrompt ? 14 : 0 }}>
                    <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 4 }}>第二轮</div>
                    <p className="task-prompt">{cfg.prompt}</p>
                  </div>
                  {current.screenContent?.phase === 'redo' && (
                    <p className="task-hint" style={{ marginTop: 10, color: '#bae6fd', fontSize: 14, lineHeight: 1.6 }}>
                      先想清楚：对象 / 任务 / 过程 / 检验，再组织你的输入与 AI 交流。同一个 AI，不换工具，用同一个任务再做一次。
                    </p>
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
                  <button type="button" className="mini-btn primary" onClick={() => setShowVocab(true)}>
                    点击查看
                  </button>
                </div>

                <div className="zone ai-zone">
                  <h3>AI 操作区</h3>
                  <div className="chat-log">
                    {vocabAttached && (
                      <div className="bubble system" style={{ opacity: 0.9 }}>
                        <span className="who">📎</span>
                        <span className="text">
                          已附加：四级核心词汇（400 词）——已随你的消息一起发送给 AI
                        </span>
                      </div>
                    )}
                    {turns.length === 0 ? (
                      <p className="hint">
                        {current.screenContent?.phase === 'redo'
                          ? '同一个 AI，不换工具，用同一个任务再做一次。先想清楚对象、任务、过程、检验，再组织你的输入。'
                          : '按你平时真实使用 AI 的方式开始，把你对任务的要求告诉 AI 即可。'}
                      </p>
                    ) : null}
                    {turns.map((t, i) => (
                      <div key={i} className={`bubble ${t.role}`}>
                        <span className="who">{t.role === 'user' ? '你' : 'AI'}</span>
                        <span className="text">{t.content}</span>
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <textarea
                      placeholder="例如：请分析这位学员最核心的词汇问题，并说明你的判断依据…"
                      value={input}
                      disabled={locked || busy}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendChat(); }}
                    />
                    <button className="secondary" disabled={busy || locked || !input.trim()} onClick={sendChat}>
                      {busy ? '思考中…' : '发送'}
                    </button>
                  </div>

                  {moduleStatus !== 'submitted' && (
                    <div className="submit-area" style={{ textAlign: 'center', padding: '20px 0 4px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16 }}>
                      <button disabled={busy || locked} onClick={() => setShowConfirm(true)} className="primary" style={{ fontSize: 15, padding: '10px 32px', borderRadius: 8 }}>
                        {current.screenContent?.phase === 'redo' ? '提交第二轮成果' : '提交第一轮成果'}
                      </button>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>完成后将记录你的使用方式，稍后与大屏一起查看前后变化</p>
                    </div>
                  )}

                  {/* 提交确认弹窗 */}
                  {showConfirm && (                    <div style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                    }} onClick={() => setShowConfirm(false)}>
                      <div style={{
                        background: '#1e293b', borderRadius: 14, padding: '28px 30px',
                        maxWidth: 400, width: '90%', border: '1px solid rgba(255,255,255,0.1)',
                      }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 10px', fontSize: 18 }}>确认提交？</h3>
                        <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                          提交后将记录你本轮与 AI 的完整操作过程，并锁定无法修改。
                          {current.screenContent?.phase === 'redo'
                            ? ' 确认你的第二轮任务已经完成了吗？'
                            : ' 确认你已经和 AI 完成了足够的对话吗？'}
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                          <button className="secondary" onClick={() => setShowConfirm(false)} style={{ padding: '8px 20px', borderRadius: 8 }}>
                            再想想
                          </button>
                          <button className="primary" disabled={busy} onClick={() => { setShowConfirm(false); submitTask(); }} style={{ padding: '8px 24px', borderRadius: 8 }}>
                            确认提交
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 四级词汇 400 词库浏览弹层 */}
                  <VocabBrowser open={showVocab} onClose={() => setShowVocab(false)} onSendToAI={sendVocabToAI} />
                </div>

                {moduleStatus === 'submitted' && profile && (
                  <div className="zone summary-zone">
                    <h3>你的操作过程（行为事实，非评价）</h3>
                    <ul className="process-list">
                      <li>与 AI 对话：<b>{profile.rounds ?? 0}</b> 轮</li>
                      <li>使用指定资料：<b>{profile.usedMaterial ? '是' : '否'}</b></li>
                      <li>主动要求 AI 检查依据：<b>{profile.verified ? '是' : '否'}</b></li>
                      <li>对第一次结果进行了修改：<b>{profile.modified ? '是' : '否'}</b></li>
                    </ul>
                    <p className="note">{message}</p>
                  </div>
                )}

                {moduleStatus === 'submitted' && (
                  <div className="zone review-zone">
                    <h3>{A1_REVIEW.headline}</h3>
                    <p className="note">{A1_REVIEW.note}</p>
                    <details className="std-box">
                      <summary>查看完整示范方案</summary>
                      <pre className="std-text">{A1_REVIEW.standardAnswer}</pre>
                    </details>
                    <h3 className="sub">对照自查：你的方案做到这些了吗？</h3>
                    <ul className="process-list">
                      {A1_REVIEW.gapPoints.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {current.type === 'single_choice' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                {(current.studentTask?.options ?? []).map((o) => (
                  <div key={o.id} style={{ marginBottom: 8 }}>
                    <label>
                      <input type="radio" name="choice" checked={form.choice === o.id} onChange={() => setForm({ ...form, choice: o.id })} />
                      {' '}{o.label}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {current.type === 'multi_choice' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                {(current.studentTask?.options ?? []).map((o) => {
                  const arr = (form.choices as string[]) ?? [];
                  return (
                    <div key={o.id} style={{ marginBottom: 8 }}>
                      <label>
                        <input type="checkbox" checked={arr.includes(o.id)} onChange={(e) => {
                          const next = e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id);
                          setForm({ ...form, choices: next });
                        }} />
                        {' '}{o.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}

            {current.type === 'short_text' && (
              <div>
                {(current.studentTask?.fields ?? []).map((f) => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, color: 'var(--muted)' }}>{f.label}</label>
                    <input value={(form[f.key] as string) ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            )}

            {current.type === 'source_select' && (
              <div>
                <p>为你的 Agent 添加一份资料：</p>
                <div className="row">
                  <button className="secondary" onClick={() => setForm({ ...form, source: 'example' })}>使用示例资料</button>
                  {current.studentTask?.allowPaste && <button className="secondary" onClick={() => setForm({ ...form, source: 'paste' })}>粘贴短资料</button>}
                </div>
                {(form.source as string) && <p className="pill blue">已选择：{String(form.source)}</p>}
              </div>
            )}

            {current.type === 'class_mirror' && (
              <div className="module-card" style={{ textAlign: 'center', paddingTop: '10vh' }}>
                <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
                <p className="note">老师正在讲解刚才全班的使用方式，跟着大屏一起看。</p>
              </div>
            )}

            {current.type === 'lecture' && (
              <div className="module-card">
                <div className="section-head">
                  <span className="badge purple">第二轮 · 你需要什么</span>
                  <h2>从聊天式使用到 Agent 式工作</h2>
                </div>
                {sp ? (
                  <>
                    <div className="style-badge">你的分类：<b>{sp.label}</b></div>
                    <h3 className="sub">重点去听</h3>
                    <p className="note">{sp.a03Focus}</p>
                    <p className="hint">听课时带着自己的类别去对照——不同类别的「重点」不一样，别听完就忘。</p>
                  </>
                ) : (
                  <p className="note">你的个性化重点将在完成第一轮实操作后生成；先跟着老师讲解走即可。</p>
                )}
              </div>
            )}

            {current.type === 'agent_config' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                {(current.studentTask?.fields ?? []).map((f) => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, color: 'var(--muted)' }}>{f.label}</label>
                    <input
                      value={(form[f.key] as string) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="agent-card">
                  <div className="agent-card-head">🤖 你的产品（实时预览）</div>
                  <div className="agent-line"><b>服务谁：</b>{String(form.who || '—')}</div>
                  <div className="agent-line"><b>目标：</b>{String(form.goal || '—')}</div>
                  <div className="agent-line"><b>交付：</b>{String(form.deliverable || '—')}</div>
                </div>
              </div>
            )}

            {current.type === 'rule_config' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                <div className="rule-list">
                  {(current.studentTask?.ruleSections ?? []).map((r) => {
                    const rules = (form.rules as Record<string, boolean>) || {};
                    return (
                      <label key={r.key} className="rule-item">
                        <input
                          type="checkbox"
                          checked={!!rules[r.key]}
                          onChange={(e) => setForm({ ...form, rules: { ...rules, [r.key]: e.target.checked } })}
                        />
                        <span><b>{r.label}</b><span className="rule-desc"> — {r.desc}</span></span>
                      </label>
                    );
                  })}
                </div>
                <div className="agent-card">
                  <div className="agent-card-head">已启用的规则（skill 雏形）</div>
                  {Object.entries((form.rules as Record<string, boolean>) || {}).filter(([, v]) => v).length === 0 ? (
                    <div className="agent-line">（尚未勾选规则）</div>
                  ) : (
                    Object.entries((form.rules as Record<string, boolean>) || {})
                      .filter(([, v]) => v)
                      .map(([k]) => {
                        const sec = (current.studentTask?.ruleSections ?? []).find((x) => x.key === k);
                        return <div key={k} className="agent-line">✓ {sec?.label ?? k}</div>;
                      })
                  )}
                </div>
              </div>
            )}

            {current.type === 'workflow_order' && (() => {
              const steps = (form.steps as string[]) ?? (current.studentTask?.workflowSteps ?? []);
              const move = (i: number, dir: -1 | 1) => {
                const next = [...steps];
                const j = i + dir;
                if (j < 0 || j >= next.length) return;
                [next[i], next[j]] = [next[j], next[i]];
                setForm({ ...form, steps: next });
              };
              return (
                <div>
                  <p>{current.studentTask?.prompt}</p>
                  <div className="workflow-list">
                    {steps.map((s, i) => (
                      <div key={i} className="workflow-item">
                        <span className="wf-idx">{i + 1}</span>
                        <span className="wf-name">{s}</span>
                        <span className="wf-actions">
                          <button type="button" className="mini-btn" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                          <button type="button" className="mini-btn" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {current.type === 'ai_run' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                <button className="primary" disabled={runLoading || locked} onClick={() => runAgent('normal')}>
                  {runLoading ? '运行中…' : '▶ 运行产品'}
                </button>
                {runError ? <p style={{ color: 'var(--red)' }}>{runError}</p> : null}
                {(form.scenario !== 'stress' && runOutput) && (
                  <div className="run-console">
                    {runSteps.length ? (
                      <div className="run-steps">执行流程：{runSteps.map((s, i) => <span key={i} className="step-chip">{s}</span>)}</div>
                    ) : null}
                    <pre className="run-output">{runOutput}</pre>
                  </div>
                )}
              </div>
            )}

            {current.type === 'stress_test' && (
              <div>
                <p>{current.studentTask?.prompt}</p>
                <button className="primary" disabled={runLoading || locked} onClick={() => runAgent('stress')}>
                  {runLoading ? '测试中…' : '⚡ 发起越界测试'}
                </button>
                {runError ? <p style={{ color: 'var(--red)' }}>{runError}</p> : null}
                {(form.scenario === 'stress' && runOutput) && (
                  <div className="run-console">
                    <pre className="run-output">{runOutput}</pre>
                    <p className="note">判断一下：它是老实说"依据不足"，还是越界编造了？把你的判断写进提交备注，或回到对比改进环节重看。</p>
                  </div>
                )}
              </div>
            )}

            {current.type === 'compare_runs' && (() => {
              let normal: any = null;
              let stress: any = null;
              try {
                normal = JSON.parse(localStorage.getItem('part2_run_normal') || 'null');
                stress = JSON.parse(localStorage.getItem('part2_run_stress') || 'null');
              } catch {
                /* noop */
              }
              if (!normal && !stress) {
                return <p className="note">请先完成运行与压力测试，再回到这里对比改进前后。</p>;
              }
              return (
                <div>
                  <p>{current.studentTask?.prompt}</p>
                  <div className="compare-grid">
                    <div className="compare-col">
                      <div className="compare-head">首次运行（正常场景）</div>
                      <pre className="run-output">{normal?.output || '（未运行）'}</pre>
                    </div>
                    <div className="compare-col">
                      <div className="compare-head">压力测试（越界场景）</div>
                      <pre className="run-output">{stress?.output || '（未运行）'}</pre>
                    </div>
                  </div>
                  <div className="agent-card">
                    <div className="agent-card-head">对照反思</div>
                    <div className="agent-line">· 正常场景里，产品是否守住了你的规则与语料范围？</div>
                    <div className="agent-line">· 越界场景里，它有没有编造？还是老实说"依据不足"？</div>
                    <div className="agent-line">· 想让它更稳，你会改哪条规则 / 哪份语料？</div>
                  </div>
                </div>
              );
            })()}

            {current.type === 'persona_config' && (() => {
              const personas = (current.studentTask?.personas ?? []) as { id: string; name: string; corpus: string; note: string }[];
              const sel = (form.selectedPersona as string) || '';
              const picked = personas.find((p) => p.id === sel);
              return (
                <div>
                  <p>{current.studentTask?.prompt}</p>
                  <div className="agent-card">
                    <div className="agent-card-head">🔒 不变的核心方法（skill）</div>
                    <div className="agent-line">{String(current.studentTask?.coreExample || '')}</div>
                  </div>
                  <div className="persona-grid">
                    {personas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`persona-card ${sel === p.id ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, selectedPersona: p.id })}
                      >
                        <div className="persona-name">{p.name}</div>
                        <div className="persona-corpus">📚 {p.corpus}</div>
                        <div className="persona-note">{p.note}</div>
                      </button>
                    ))}
                  </div>
                  {picked ? (
                    <div className="agent-card">
                      <div className="agent-card-head">选中的对象：{picked.name}</div>
                      <div className="agent-line"><b>语料库（变）：</b>{picked.corpus}</div>
                      <div className="agent-line"><b>核心方法（不变）：</b>角色 / 规则 / 流程一致</div>
                      <div className="agent-line note">→ 同一套方法，喂不同语料，就服务了不同的人。这正是"一人公司（多 Agent）"的雏形。</div>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {['l2_intro', 'knowledge_select', 'skill_build', 'assistant_try'].includes(current.type) && (
              <L2StudentFlow
                current={current}
                anonymousId={anonymousId}
                locked={locked}
                moduleStatus={moduleStatus}
                onSubmitted={() => refreshRef.current()}
              />
            )}

            {!['waiting', 'single_choice', 'multi_choice', 'short_text', 'source_select', 'ai_task', 'hr_screening', 'class_mirror', 'lecture', 'agent_config', 'rule_config', 'workflow_order', 'ai_run', 'stress_test', 'compare_runs', 'persona_config', 'finale', 'knowledge_select', 'skill_build', 'assistant_try', 'a0_new', 'avatar_flow', 'site_entry', 'grow_game'].includes(current.type) && (
              <p className="note">此模块类型（{current.type}）将在后续 Sprint 实现；当前演示版仅打通投票/文本/资料/AI 任务模块。</p>
            )}

            {moduleStatus !== 'submitted' && current.type !== 'waiting' && current.type !== 'ai_task' && current.type !== 'hr_screening' && current.type !== 'class_mirror' && current.type !== 'lecture' && current.type !== 'l2_intro' && current.type !== 'knowledge_select' && current.type !== 'skill_build' && current.type !== 'assistant_try' && current.type !== 'finale' && current.type !== 'a0_new' && current.type !== 'avatar_flow' && current.type !== 'site_entry' && current.type !== 'grow_game' && (
              <div style={{ marginTop: 16 }}>
                <button disabled={busy || locked} onClick={submit}>
                  {busy ? '提交中…' : '提交'}
                </button>
              </div>
            )}
            {message && current.type !== 'ai_task' ? <p style={{ color: 'var(--green)' }}>{message}</p> : null}
          </>
        </div>
      </>)}
    </div>
  );
}

// 开场故事阶段：学生端纯等待页，只看大屏
function StudentStoryWait() {
  return (
    <div className="student-waiting">
      <div className="sw-top">
        <span className="sw-brand">顷悟 · AI 互动体验课</span>
      </div>
      <div className="sw-stage">
        <div className="sw-avatar">
          <div className="sw-frame">
            <svg className="sw-bust" viewBox="0 0 120 120" aria-hidden>
              <defs>
                <linearGradient id="swBust" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#e2e8f0" />
                  <stop offset="1" stopColor="#94a3b8" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="46" r="22" fill="url(#swBust)" />
              <path d="M22 114 C22 84 42 76 60 76 C78 76 98 84 98 114 Z" fill="url(#swBust)" />
              <path d="M52 78 L60 96 L68 78 Z" fill="#0b1220" />
            </svg>
            <span className="sw-ring" />
          </div>
          <div className="sw-connecting">已入场 · 等待开场</div>
        </div>
      </div>
      <div className="sw-core">
        <div className="sw-title">请看大屏</div>
        <div className="sw-sub">老师正在讲开场，跟着大屏一起看。</div>
      </div>
      <div className="sw-foot">
        <span className="sw-dot" />
        <span>讲完开场，我们马上开始</span>
      </div>
    </div>
  );
}
