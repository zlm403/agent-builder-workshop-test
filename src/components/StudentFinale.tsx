'use client';

import { useState, useEffect, useRef } from 'react';
import {
  SCENE_LABEL,
  SCENE_ICON,
  SCENE_ROLES,
  AGENT_FIELDS,
  type FinaleAgent,
} from '@/lib/finaleConfig';

type CompanySummary = {
  id: string;
  name: string;
  scene: string;
  ownerName: string | null;
  agents: { role: string; nickname: string }[];
  publishedAt: string | null;
};

type FinaleStep = { role: string; nickname: string; input: string; output: string };

const SCENES = [
  { key: 'study', desc: '帮人提分' },
  { key: 'shopping', desc: '帮人省钱' },
  { key: 'fun', desc: '帮人找乐子' },
];

export default function StudentFinale({
  sessionId,
  anonymousId,
  nickname,
}: {
  sessionId: string;
  anonymousId: string;
  nickname: string;
}) {
  const [tab, setTab] = useState<'build' | 'visit'>('build');
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  // 搭建态
  const [scene, setScene] = useState('');
  const [name, setName] = useState('');
  const [agents, setAgents] = useState<FinaleAgent[]>([]);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [buildMsg, setBuildMsg] = useState('');

  // 访问态
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [active, setActive] = useState<CompanySummary | null>(null);
  const [msgs, setMsgs] = useState<{ role: 'user' | 'agent'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<FinaleStep[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [runError, setRunError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackDone, setFeedbackDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 拉取终章状态
  async function refreshState() {
    const r = await fetch(`/api/finale/state?sessionId=${sessionId}`);
    const d = await r.json();
    setOpen(!!d.open);
    setRound(d.round ?? 0);
    if (Array.isArray(d.companies)) setCompanies(d.companies);
  }

  useEffect(() => {
    refreshState();
    const t = setInterval(refreshState, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 选择场景 → 初始化 4 个 Agent 属性卡
  function chooseScene(key: string) {
    setScene(key);
    const roles = SCENE_ROLES[key] ?? ['客户接待', '需求诊断', '方案执行', '交付跟进'];
    setAgents(roles.map((role) => ({ role, nickname: '', personality: '', duty: '', boundary: '', rules: '', handoff: '' })));
    if (!name) setName('');
  }

  function setAgentField(i: number, key: keyof FinaleAgent, val: string) {
    setAgents((arr) => arr.map((a, idx) => (idx === i ? { ...a, [key]: val } : a)));
  }

  async function publish() {
    if (!scene || agents.length !== 4) return;
    if (agents.some((a) => !a.nickname.trim() || !a.duty.trim())) {
      setBuildMsg('请至少给每个员工填「昵称」和「职责」，其余可留空');
      return;
    }
    setBuildMsg('');
    try {
      const res = await fetch('/api/finale/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, anonymousId, scene, name: name || `${nickname || '我'}的 AI 公司`, agents }),
      });
      const d = await res.json();
      if (d.error) {
        setBuildMsg(d.error.message || '发布失败');
        return;
      }
      setPublishedId(d.id);
      await refreshState();
    } catch {
      setBuildMsg('网络错误，发布失败');
    }
  }

  function openVisit(c: CompanySummary) {
    setActive(c);
    setMsgs([]);
    setSteps([]);
    setRevealed(0);
    setFinalText('');
    setRunError('');
    setRating(0);
    setComment('');
    setFeedbackDone(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function runVisit() {
    if (running || !active || !input.trim()) return;
    const msg = input.trim();
    setInput('');
    setRunError('');
    setMsgs((m) => [...m, { role: 'user', text: msg }]);
    setSteps([]);
    setRevealed(0);
    setFinalText('');
    setFeedbackDone(false);
    setRunning(true);
    try {
      const res = await fetch('/api/finale/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: active.id, anonymousId, message: msg }),
      });
      const d = await res.json();
      if (d.error) {
        setRunError(d.error.message || '运行失败');
        setRunning(false);
        return;
      }
      const st: FinaleStep[] = d.steps || [];
      setSteps(st);
      let i = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        i += 1;
        setRevealed(i);
        if (i >= st.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setFinalText(d.final || '');
          setRunning(false);
        }
      }, 1700);
    } catch {
      setRunError('运行失败，请重试');
      setRunning(false);
    }
  }

  async function submitFeedback() {
    if (!active) return;
    try {
      await fetch('/api/finale/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId: active.id, anonymousId, rating, comment }),
      });
      setFeedbackDone(true);
    } catch {
      /* noop */
    }
  }

  function agentStatus(i: number): 'done' | 'working' | 'waiting' {
    if (i < revealed) return 'done';
    if (i === revealed && running) return 'working';
    return 'waiting';
  }

  return (
    <div className="finale-wrap">
      <div className="finale-head">
        <div>
          <div className="finale-kicker">终章 · 一人公司</div>
          <h2>搭一个会自己干活的 AI 团队</h2>
        </div>
        <div className="finale-tabs">
          <button className={tab === 'build' ? 'ftab active' : 'ftab'} onClick={() => setTab('build')}>
            ① 搭建我的公司
          </button>
          <button className={tab === 'visit' ? 'ftab active' : 'ftab'} onClick={() => setTab('visit')}>
            ② 去体验别人的
          </button>
        </div>
      </div>

      {tab === 'build' && (
        <div className="finale-build">
          {!scene ? (
            <div>
              <p className="finale-tip">先选一个方向。框架都一样：4 个员工（接待 → 诊断 → 执行 → 交付），你只需给每个员工填属性卡。</p>
              <div className="scene-grid">
                {SCENES.map((s) => (
                  <button key={s.key} className="scene-card" onClick={() => chooseScene(s.key)}>
                    <div className="scene-ico">{SCENE_ICON[s.key]}</div>
                    <div className="scene-name">{SCENE_LABEL[s.key]}公司</div>
                    <div className="scene-desc">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : publishedId ? (
            <div className="publish-ok">
              <div className="ok-badge">✓ 已发布到第 {round} 轮</div>
              <p>你的 4 个员工已经上线，别人现在可以来体验你的公司了。</p>
              <button className="primary" onClick={() => setTab('visit')}>
                去看看别人的公司 →
              </button>
            </div>
          ) : (
            <div>
              <div className="build-bar">
                <button className="link-btn" onClick={() => setScene('')}>
                  ← 换方向
                </button>
                <span className="build-scene">
                  {SCENE_ICON[scene]} {SCENE_LABEL[scene]}公司
                </span>
              </div>
              <input
                className="company-name"
                placeholder="给公司起个名字，例如「考研上岸研究所」"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
              {!open && <p className="finale-warn">老师还没开放发布。你可以先把属性卡填好，等老师说“现在发布”再点下面的按钮。</p>}
              <div className="agent-cards">
                {agents.map((a, i) => (
                  <div key={i} className="agent-card-edit">
                    <div className="ace-head">
                      <span className="ace-idx">{i + 1}</span>
                      <span className="ace-role">{a.role}</span>
                    </div>
                    {AGENT_FIELDS.map((f) => (
                      <div key={f.key} className="ace-field">
                        <label>{f.label}</label>
                        {f.rows ? (
                          <textarea
                            rows={f.rows}
                            placeholder={f.placeholder}
                            value={(a[f.key] as string) ?? ''}
                            onChange={(e) => setAgentField(i, f.key, e.target.value)}
                            maxLength={500}
                          />
                        ) : (
                          <input
                            placeholder={f.placeholder}
                            value={(a[f.key] as string) ?? ''}
                            onChange={(e) => setAgentField(i, f.key, e.target.value)}
                            maxLength={40}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {buildMsg ? <p className="finale-warn">{buildMsg}</p> : null}
              <button className="primary publish-btn" disabled={!open} onClick={publish}>
                {open ? '🚀 发布我的 AI 公司' : '等待老师开放发布…'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'visit' && (
        <div className="finale-visit">
          {!active ? (
            <div>
              <p className="finale-tip">点开任意一家公司的「进入」，输入你的真实需求，看它的 4 个员工自己配合完成。</p>
              {companies.length === 0 ? (
                <p className="finale-warn">这一轮还没有人发布产品。回去搭一个，或等同学发布。</p>
              ) : (
                <div className="company-grid">
                  {companies.map((c) => (
                    <button key={c.id} className="company-card" onClick={() => openVisit(c)}>
                      <div className="cc-scene">
                        {SCENE_ICON[c.scene]} {SCENE_LABEL[c.scene]}
                      </div>
                      <div className="cc-name">{c.name}</div>
                      <div className="cc-owner">by {c.ownerName || '匿名同学'}</div>
                      <div className="cc-agents">
                        {c.agents.map((a, i) => (
                          <span key={i} className="cc-agent">
                            {a.nickname || a.role}
                          </span>
                        ))}
                      </div>
                      <div className="cc-enter">进入体验 →</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="visit-room">
              <div className="vr-head">
                <button className="link-btn" onClick={() => setActive(null)}>
                  ← 退出，换一家
                </button>
                <span className="vr-title">
                  {SCENE_ICON[active.scene]} {active.name}
                </span>
              </div>

              <div className="vr-body">
                <div className="vr-chat">
                  {msgs.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'bubble user' : 'bubble agent'}>
                      {m.text}
                    </div>
                  ))}
                  {running && <div className="bubble agent typing">四个员工正在协作处理…</div>}
                  {runError ? <div className="bubble err">{runError}</div> : null}
                  {finalText && !running ? (
                    <div className="bubble final">
                      <div className="final-head">📦 最终交付</div>
                      <pre>{finalText}</pre>
                    </div>
                  ) : null}
                </div>

                <div className="vr-panel">
                  <div className="panel-title">Agent 工作可视化</div>
                  {steps.length === 0 && !running ? (
                    <div className="panel-empty">发送需求后，这里会实时显示每个员工的工作状态。</div>
                  ) : (
                    <div className="agent-flow">
                      {steps.map((s, i) => {
                        const st = agentStatus(i);
                        return (
                          <div key={i} className={`flow-node ${st}`}>
                            <div className="fn-top">
                              <span className="fn-idx">{i + 1}</span>
                              <span className="fn-role">{s.nickname || s.role}</span>
                              <span className="fn-state">
                                {st === 'done' ? '✅' : st === 'working' ? '🟢 工作中' : '⏳ 等待'}
                              </span>
                            </div>
                            {st !== 'waiting' && (
                              <div className="fn-output">
                                <pre>{s.output}</pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {finalText && !running && (
                <div className="vr-feedback">
                  <div className="fb-title">给这家公司打个分</div>
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} className={n <= rating ? 'star on' : 'star'} onClick={() => setRating(n)}>
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="一句话感受？例如「那个铁血诊断官真的一个『可能』都没说」"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                  />
                  <button className="primary" disabled={feedbackDone} onClick={submitFeedback}>
                    {feedbackDone ? '✓ 已提交反馈' : '提交反馈'}
                  </button>
                </div>
              )}

              <div className="vr-input">
                <input
                  placeholder="说出你的需求，例如「我想买生日礼物送女朋友，预算300」"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runVisit()}
                  disabled={running}
                />
                <button className="primary" onClick={runVisit} disabled={running || !input.trim()}>
                  发送
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
