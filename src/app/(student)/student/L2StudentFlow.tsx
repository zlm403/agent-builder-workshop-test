'use client';

import { useEffect, useState } from 'react';
import { KNOWLEDGE_DOCS, SKILL_BLOCKS } from '@/lib/courseConfig';

// 与后端 L2ProcessData 对齐的最小结构（前端只用，不做严格类型校验）
type SkillVersion = {
  understand: string;
  judge: string;
  execute: string;
  sourcePriorityRule: string;
  feedback: string;
};

type LearnerRunResult = {
  learnerId: string;
  trainingFocus: string;
  materialDifficulty: string;
  trainingTask: string;
  trainingDuration: string;
  feedbackMethod: string;
  references: { docId: string; usage: string; evidence: string }[];
};

type DualRunResponse = {
  runId: string;
  generationMode: string;
  learnerA: LearnerRunResult;
  learnerB: LearnerRunResult;
  warnings: string[];
};

type AiCheckResult = {
  overallStatus: string;
  positiveFindings: string[];
  issues: string[];
  evidence: string[];
  recommendations: string[];
  diagnosisType: string;
};

const LEARNER_NAMES: Record<string, string> = { lin: '小林', zhou: '小周' };
const RATING_COLOR: Record<string, string> = {
  高: '#16a34a',
  中: '#ca8a04',
  低: '#dc2626',
  未知: '#64748b',
};

function blankSkill(): SkillVersion {
  return { understand: '', judge: '', execute: '', sourcePriorityRule: '', feedback: '' };
}

function defaultProcess(): any {
  return {
    knowledgeBase: { initialSelection: [] },
    skill: { initialVersion: blankSkill(), finalVersion: blankSkill() },
    firstRun: null,
    secondRun: null,
    aiCheck: null,
  };
}

// ---------------------------------------------------------------------------
// 主组件：加载共享 L2 过程数据，按模块类型分派
// ---------------------------------------------------------------------------
export default function L2StudentFlow({
  current,
  anonymousId,
  locked,
  moduleStatus,
  onSubmitted,
}: {
  current: { id: string; title: string; type: string; studentTask?: any; screenContent?: any };
  anonymousId: string;
  locked: boolean;
  moduleStatus: string;
  onSubmitted: () => void;
}) {
  const [process, setProcess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/l2/process?anonymousId=${encodeURIComponent(anonymousId)}`);
        const d = await res.json();
        if (active) setProcess(d.process ?? defaultProcess());
      } catch {
        if (active) setProcess(defaultProcess());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [anonymousId]);

  async function save(partial: any) {
    const base = process ?? defaultProcess();
    const next = { ...base, ...partial };
    setProcess(next);
    try {
      await fetch('/api/l2/process', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, data: next }),
      });
    } catch {
      /* 保存失败静默处理，下次操作会重试 */
    }
  }

  async function finish(payload?: any) {
    setBusy(true);
    setMessage('');
    try {
      if (payload) {
        const base = process ?? defaultProcess();
        const next = { ...base, ...payload };
        setProcess(next);
        await fetch('/api/l2/process', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymousId, data: next }),
        });
      }
      // 提交前拉取后端最新完整过程数据，避免本地 process 缺少 run/check 等字段
      // 导致 submit 覆盖 A06_TRY 中由 /api/l2/run、/api/l2/check 写入的结果
      let toSubmit: any = payload ?? process ?? {};
      try {
        const r = await fetch(`/api/l2/process?anonymousId=${encodeURIComponent(anonymousId)}`);
        if (r.ok) {
          const d = await r.json();
          if (d.process) toSubmit = { ...d.process, ...(payload ?? {}) };
        }
      } catch {
        /* ignore */
      }
      const res = await fetch('/api/module/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, moduleId: current.id, data: toSubmit }),
      });
      if (!res.ok) {
        const d = await res.json();
        setMessage(d.error?.code === 'MODULE_LOCKED' ? '当前环节已锁定' : '提交失败');
        return;
      }
      setMessage('已提交，等待教师推进到下一环节。');
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="note">加载中…</p>;

  const submitted = moduleStatus === 'submitted';

  switch (current.type) {
    case 'knowledge_select':
      return (
        <A04Knowledge
          st={current.studentTask}
          process={process}
          locked={locked}
          submitted={submitted}
          onSelect={(docs: string[]) => save({ knowledgeBase: { ...process.knowledgeBase, initialSelection: docs } })}
          onFinish={finish}
          busy={busy}
          message={message}
        />
      );
    case 'skill_build':
      return (
        <A05Skill
          st={current.studentTask}
          process={process}
          locked={locked}
          submitted={submitted}
          onFinish={(skill: SkillVersion) =>
            finish({ skill: { ...process.skill, initialVersion: skill, finalVersion: skill } })
          }
          busy={busy}
          message={message}
        />
      );
    case 'l2_intro': {
      const st: any = current.studentTask ?? {};
      const sc: any = current.screenContent ?? {};
      const personas: any[] = sc.personas ?? [];
      return (
        <div>
          <div className="card">
            <p className="note">{st.prompt}</p>
            {(st.details ?? []).map((d: string, i: number) => (
              <div key={i} style={{ marginBottom: 6 }}>· {d}</div>
            ))}
            {sc.coreQuestion && (
              <p style={{ marginTop: 10, color: 'var(--green)', fontWeight: 700 }}>
                核心问题：{sc.coreQuestion}
              </p>
            )}
            {(sc.flow ?? []).length > 0 && (
              <p className="note" style={{ marginTop: 8 }}>
                第二关流程：<b>{sc.flow.join('  →  ')}</b>
              </p>
            )}
            {personas.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 12,
                  marginTop: 14,
                }}
              >
                {personas.map((p) => (
                  <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}（基础{p.base}）</div>
                    <div className="note" style={{ fontSize: 12, marginTop: 4 }}>
                      可用时间：{p.availableTime} · 目标：{p.goal}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      <div><b>主要问题：</b>{p.mainProblem}</div>
                      <div><b>薄弱题型：</b>{p.weakType}</div>
                      <div><b>偏好：</b>{p.preference}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!submitted && (
            <div style={{ marginTop: 16 }}>
<button disabled={busy || locked} onClick={finish}>
                  {busy ? '提交中…' : st.submitLabel ?? '我明白了，开始第二关'}
                </button>
            </div>
          )}
          {message && <p style={{ color: 'var(--green)' }}>{message}</p>}
        </div>
      );
    }
    case 'assistant_try':
      return (
        <A06Try
          st={current.studentTask}
          process={process}
          locked={locked}
          submitted={submitted}
          anonymousId={anonymousId}
          onSave={save}
          onFinish={finish}
          busy={busy}
          message={message}
        />
      );
    default:
      return <p className="note">未知的第二关模块类型：{current.type}</p>;
  }
}

// ---------------------------------------------------------------------------
// A04：选择知识库资料
// ---------------------------------------------------------------------------
function A04Knowledge({
  st,
  process,
  locked,
  submitted,
  onSelect,
  onFinish,
  busy,
  message,
}: {
  st: any;
  process: any;
  locked: boolean;
  submitted: boolean;
  onSelect: (docs: string[]) => void;
  onFinish: () => void;
  busy: boolean;
  message: string;
}) {
  const selected: string[] = process?.knowledgeBase?.initialSelection ?? [];
  const max = st?.maxSelect ?? st?.criteria?.maxSelect ?? 4;

  function toggle(id: string) {
    if (submitted || locked) return;
    let next: string[];
    if (selected.includes(id)) next = selected.filter((x) => x !== id);
    else if (selected.length >= max) return;
    else next = [...selected, id];
    onSelect(next);
  }

  return (
    <div>
      <div className="card">
        <p className="note">{st?.prompt}</p>
        <p className="note">
          已选 <b>{selected.length}</b> / {max}。选择标准（{st?.criteria?.dimensions?.join('、') ?? '相关性 / 可靠性 / 时效性'}）：
          每份资料都要能"支撑一个训练安排"，而不是只看是否"相关"。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {KNOWLEDGE_DOCS.map((d) => {
            const on = selected.includes(d.id);
            return (
              <div
                key={d.id}
                onClick={() => toggle(d.id)}
                style={{
                  border: on ? '2px solid #16a34a' : '1px solid #ddd',
                  borderRadius: 8,
                  padding: 12,
                  cursor: submitted || locked ? 'default' : 'pointer',
                  background: on ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ fontWeight: 700 }}>{d.title}</div>
                <div className="note" style={{ fontSize: 12 }}>
                  来源：{d.source} · 更新：{d.updatedAt}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{d.summary}</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  相关性：<span style={{ color: RATING_COLOR[d.relevance] }}>{d.relevance}</span> ·
                  可靠性：<span style={{ color: RATING_COLOR[d.reliability] }}>{d.reliability}</span> ·
                  时效性：<span style={{ color: RATING_COLOR[d.timeliness] }}>{d.timeliness}</span>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>推荐类别：{d.recommendedClass}</div>
                {on && (
                  <div style={{ color: '#16a34a', fontWeight: 700, marginTop: 6 }}>已选 ✓</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!submitted && (
        <div style={{ marginTop: 16 }}>
          <button
            disabled={busy || locked || selected.length !== max}
            onClick={onFinish}
          >
            {busy ? '提交中…' : st?.submitLabel ?? '建立知识库，开始编写 Skill'}
          </button>
          {selected.length !== max && (
            <span className="note" style={{ marginLeft: 10 }}>
              需恰好选择 {max} 份
            </span>
          )}
        </div>
      )}
      {message && <p style={{ color: 'var(--green)' }}>{message}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A05：编写 Skill
// ---------------------------------------------------------------------------
function A05Skill({
  st,
  process,
  locked,
  submitted,
  onFinish,
  busy,
  message,
}: {
  st: any;
  process: any;
  locked: boolean;
  submitted: boolean;
  onFinish: (skill: SkillVersion) => void;
  busy: boolean;
  message: string;
}) {
  const init: SkillVersion = {
    understand: process?.skill?.initialVersion?.understand ?? '',
    judge: process?.skill?.initialVersion?.judge ?? '',
    execute: process?.skill?.initialVersion?.execute ?? '',
    sourcePriorityRule: process?.skill?.initialVersion?.sourcePriorityRule ?? '',
    feedback: process?.skill?.initialVersion?.feedback ?? '',
  };
  const [skill, setSkill] = useState<SkillVersion>(init);

  function update(key: keyof SkillVersion, val: string) {
    setSkill((s) => ({ ...s, [key]: val }));
  }

  return (
    <div>
      <div className="card">
        <p className="note">{st?.prompt}</p>
        {SKILL_BLOCKS.map((b) => (
          <div key={b.key} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700 }}>{b.title}</div>
            <div className="note" style={{ fontSize: 12 }}>参考句：{b.fixedSentence}</div>
            <div className="note" style={{ fontSize: 12 }}>
              关键词：{b.keywords?.join('、')}（至少 {b.minLength} 字）
            </div>
            <textarea
              value={(skill as any)[b.key] ?? ''}
              disabled={submitted || locked}
              onChange={(e) => update(b.key as keyof SkillVersion, e.target.value)}
              style={{ width: '100%', minHeight: 70, marginTop: 6 }}
              placeholder={`请填写「${b.title}」`}
            />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>知识使用规则（source priority）</div>
          <div className="note" style={{ fontSize: 12 }}>{st?.sourcePriorityHint}</div>
          <textarea
            value={skill.sourcePriorityRule}
            disabled={submitted || locked}
            onChange={(e) => update('sourcePriorityRule', e.target.value)}
            style={{ width: '100%', minHeight: 60, marginTop: 6 }}
            placeholder="当不同资料说法冲突时，优先相信哪一类？"
          />
        </div>
      </div>
      {!submitted && (
        <div style={{ marginTop: 16 }}>
          <button disabled={busy || locked} onClick={() => onFinish({ ...skill })}>
            {busy ? '提交中…' : st?.submitLabel ?? '运行我的助手'}
          </button>
        </div>
      )}
      {message && <p style={{ color: 'var(--green)' }}>{message}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A06：运行 · 检查 · 修改 · 提交
// ---------------------------------------------------------------------------
function A06Try({
  st,
  process,
  locked,
  submitted,
  anonymousId,
  onSave,
  onFinish,
  busy,
  message,
}: {
  st: any;
  process: any;
  locked: boolean;
  submitted: boolean;
  anonymousId: string;
  onSave: (partial: any) => void;
  onFinish: () => void;
  busy: boolean;
  message: string;
}) {
  const [run, setRun] = useState<DualRunResponse | null>(
    process?.firstRun ? {
      runId: 'cached',
      generationMode: process.firstRun.generationMode,
      learnerA: process.firstRun.learnerA,
      learnerB: process.firstRun.learnerB,
      warnings: [],
    } : null,
  );
  const [check, setCheck] = useState<AiCheckResult | null>(process?.aiCheck ?? null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [editing, setEditing] = useState(false);
  const initSkill: SkillVersion = {
    understand: process?.skill?.initialVersion?.understand ?? '',
    judge: process?.skill?.initialVersion?.judge ?? '',
    execute: process?.skill?.initialVersion?.execute ?? '',
    sourcePriorityRule: process?.skill?.initialVersion?.sourcePriorityRule ?? '',
    feedback: process?.skill?.initialVersion?.feedback ?? '',
  };
  const [editSkill, setEditSkill] = useState<SkillVersion>(initSkill);

  function docTitle(id: string): string {
    const d = KNOWLEDGE_DOCS.find((x) => x.id === id);
    return d ? `《${d.title}》` : id;
  }

  async function handleRun(action: 'first' | 'second', skillOverride?: SkillVersion) {
    const selection: string[] = process?.knowledgeBase?.initialSelection ?? [];
    if (selection.length !== 4) {
      setMessage('请先完成上一个模块（选择 4 份知识库资料）。');
      return;
    }
    const skill = skillOverride ?? process?.skill?.initialVersion ?? blankSkill();
    if (!skill.understand && !skill.judge && !skill.execute) {
      setMessage('请先完成上一个模块（编写 Skill）。');
      return;
    }
    setLoadingRun(true);
    setMessage('');
    try {
      const res = await fetch('/api/l2/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, action, knowledgeSelection: selection, skill }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error?.message ?? '运行失败');
        return;
      }
      setRun(d.run);
      if (action === 'second' && skillOverride) {
        onSave({ skill: { ...process.skill, finalVersion: skillOverride } });
      }
    } finally {
      setLoadingRun(false);
    }
  }

  async function handleCheck() {
    setLoadingCheck(true);
    setMessage('');
    try {
      const res = await fetch('/api/l2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error?.message ?? '检查失败');
        return;
      }
      setCheck(d.check);
    } finally {
      setLoadingCheck(false);
    }
  }

  function renderLearner(l: LearnerRunResult) {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{LEARNER_NAMES[l.learnerId] ?? l.learnerId}</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>
          <div><b>训练重点：</b>{l.trainingFocus}</div>
          <div><b>材料难度：</b>{l.materialDifficulty}</div>
          <div><b>训练任务：</b>{l.trainingTask}</div>
          <div><b>训练时长：</b>{l.trainingDuration}</div>
          <div><b>反馈方式：</b>{l.feedbackMethod}</div>
        </div>
        {l.references?.length ? (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <b>引用资料：</b>
            {l.references.map((r, i) => (
              <div key={i}>
                {docTitle(r.docId)} — {r.usage}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>（未引用具体资料）</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <p className="note">{st?.task ?? st?.prompt}</p>

        {!run && (
          <button disabled={loadingRun || locked} onClick={() => handleRun('first')}>
            {loadingRun ? '运行中…' : st?.runButtonLabel ?? '运行我的助手'}
          </button>
        )}

        {run && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>两人运行结果</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {renderLearner(run.learnerA)}
              {renderLearner(run.learnerB)}
            </div>
            {run.generationMode && (
              <div className="note" style={{ fontSize: 12, marginTop: 6 }}>
                生成方式：{run.generationMode}
                {run.warnings?.includes('OFFLINE_EXAMPLE_RETURNED') ? '（课堂示例，非你的真实运行）' : ''}
              </div>
            )}
          </div>
        )}

        {run && !check && (
          <div style={{ marginTop: 12 }}>
            <button disabled={loadingCheck || locked} onClick={handleCheck}>
              {loadingCheck ? '检查中…' : st?.checkButtonLabel ?? '请 AI 检查'}
            </button>
          </div>
        )}

        {check && (
          <div style={{ marginTop: 12, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>AI 检查报告</div>
            <div className="note">{check.overallStatus}（类型：{check.diagnosisType}）</div>
            {check.positiveFindings?.length ? (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <b>亮点：</b>
                {check.positiveFindings.map((x, i) => (
                  <div key={i}>· {x}</div>
                ))}
              </div>
            ) : null}
            {check.issues?.length ? (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <b>问题：</b>
                {check.issues.map((x, i) => (
                  <div key={i}>· {x}</div>
                ))}
              </div>
            ) : null}
            {check.evidence?.length ? (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <b>证据：</b>
                {check.evidence.map((x, i) => (
                  <div key={i}>· {x}</div>
                ))}
              </div>
            ) : null}
            {check.recommendations?.length ? (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <b>建议：</b>
                {check.recommendations.map((x, i) => (
                  <div key={i}>· {x}</div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 修改：编辑 Skill 后重新运行 */}
      {run && !submitted && (
        <div className="card" style={{ marginTop: 16 }}>
          <button type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? '收起修改' : st?.modifyButtonLabel ?? '修改我的 Skill'}
          </button>
          {editing && (
            <div style={{ marginTop: 12 }}>
              {SKILL_BLOCKS.map((b) => (
                <div key={b.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>{b.title}</div>
                  <textarea
                    value={(editSkill as any)[b.key] ?? ''}
                    onChange={(e) =>
                      setEditSkill((s) => ({ ...s, [b.key]: e.target.value }))
                    }
                    style={{ width: '100%', minHeight: 60 }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>知识使用规则</div>
                <textarea
                  value={editSkill.sourcePriorityRule}
                  onChange={(e) =>
                    setEditSkill((s) => ({ ...s, sourcePriorityRule: e.target.value }))
                  }
                  style={{ width: '100%', minHeight: 50 }}
                />
              </div>
              <button
                disabled={loadingRun || locked}
                onClick={() => handleRun('second', { ...editSkill })}
              >
                {loadingRun ? '重新运行中…' : st?.resubmitLabel ?? '保存并重新运行'}
              </button>
              {check && (
                <button
                  type="button"
                  style={{ marginLeft: 10 }}
                  disabled={loadingCheck || locked}
                  onClick={handleCheck}
                >
                  {loadingCheck ? '重新检查中…' : '重新检查'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!submitted && (
        <div style={{ marginTop: 16 }}>
          <button disabled={busy || locked} onClick={onFinish}>
            {busy ? '提交中…' : st?.finalSubmitLabel ?? '提交最终版本'}
          </button>
        </div>
      )}
      {message && <p style={{ color: 'var(--green)' }}>{message}</p>}
    </div>
  );
}
