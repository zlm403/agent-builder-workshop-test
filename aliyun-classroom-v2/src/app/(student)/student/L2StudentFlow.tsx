'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { KNOWLEDGE_DOCS, SKILL_BLOCKS } from '@/lib/courseConfig';
import { api } from '@/lib/basePath';

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
  skillEvaluation?: { block: string; status: string; comment: string }[];
};

const LEARNER_NAMES: Record<string, string> = { lin: '小林', zhou: '小周' };
const RATING_COLOR: Record<string, string> = {
  高: 'var(--green)',
  中: 'var(--yellow)',
  低: 'var(--red)',
  未知: 'var(--muted)',
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
        const res = await fetch(api(`/api/l2/process?anonymousId=${encodeURIComponent(anonymousId)}`));
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
      await fetch(api('/api/l2/process'), {
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
        await fetch(api('/api/l2/process'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymousId, data: next }),
        });
      }
      // 提交前拉取后端最新完整过程数据，避免本地 process 缺少 run/check 等字段
      // 导致 submit 覆盖 A06_TRY 中由 /api/l2/run、/api/l2/check 写入的结果
      let toSubmit: any = payload ?? process ?? {};
      try {
        const r = await fetch(api(`/api/l2/process?anonymousId=${encodeURIComponent(anonymousId)}`));
        if (r.ok) {
          const d = await r.json();
          if (d.process) toSubmit = { ...d.process, ...(payload ?? {}) };
        }
      } catch {
        /* ignore */
      }
      const res = await fetch(api('/api/module/submit'), {
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
      // 教师讲解阶段：学生屏极简，不展开 personas/flow/details，避免抢注意力（请看大屏）
      return (
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>第二关开始</div>
            <p className="note" style={{ fontSize: 18, color: '#cbd5e1' }}>请看大屏</p>
            <p className="note" style={{ marginTop: 16, color: 'var(--muted)', fontSize: 14 }}>
              教师正在讲解第二关的任务和两位使用者，请专注大屏。
            </p>
          </div>
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
          setMessage={setMessage}
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
                border: on ? '2px solid var(--green)' : '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                cursor: submitted || locked ? 'default' : 'pointer',
                background: on ? 'rgba(34,197,94,0.12)' : 'var(--card)',
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
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>推荐类别：{d.recommendedClass}</div>
                {on && (
                  <div style={{ color: 'var(--green)', fontWeight: 700, marginTop: 6 }}>已选 ✓</div>
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
            onClick={() => onFinish()}
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
  setMessage,
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
  setMessage: (msg: string) => void;
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
  // 本地轮次计数：每次运行成功后 +1，不依赖 process（process 只在挂载时加载一次，secondRun 不会更新）
  const [runCount, setRunCount] = useState(
    process?.secondRun ? 2 : (process?.firstRun ? 1 : 0),
  );
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [editing, setEditing] = useState(false);
  // A06 卡片切换：默认选中小林（A），可切换看小周（B）
  const [selectedPersona, setSelectedPersona] = useState<'A' | 'B'>('A');
  // 视图模式：single（卡片切换，下方窗口显示单人）/ sideBySide（两人并排）
  const [viewMode, setViewMode] = useState<'single' | 'sideBySide'>('single');
  const initSkill: SkillVersion = {
    understand: process?.skill?.initialVersion?.understand ?? '',
    judge: process?.skill?.initialVersion?.judge ?? '',
    execute: process?.skill?.initialVersion?.execute ?? '',
    sourcePriorityRule: process?.skill?.initialVersion?.sourcePriorityRule ?? '',
    feedback: process?.skill?.initialVersion?.feedback ?? '',
  };
  const [editSkill, setEditSkill] = useState<SkillVersion>(initSkill);
  // 知识库也可在 A06 直接选/换（学生可能 A04 没选完就被推到 A06）
  const [editSelection, setEditSelection] = useState<string[]>(
    process?.knowledgeBase?.initialSelection ?? [],
  );

  // 进入 A06 立即自动运行，无需点击"开始运行"
  // 等待 process 加载完成即可触发（不要求数据完整，后端会兜底返回示例）
  const startedRef = useRef(false);
  useEffect(() => {
    if (!run && !startedRef.current && process) {
      startedRef.current = true;
      handleRun('first');
    }
  }, [process, run]);

  function docTitle(id: string): string {
    const d = KNOWLEDGE_DOCS.find((x) => x.id === id);
    return d ? `《${d.title}》` : id;
  }

  async function handleRun(action: 'first' | 'second', skillOverride?: SkillVersion, selectionOverride?: string[]) {
    const selection: string[] = selectionOverride ?? editSelection ?? process?.knowledgeBase?.initialSelection ?? [];
    // 只做软提示，不阻断——A06 是工作台，学生可能正在修改 Skill 重新跑
    if (selection.length !== 4) {
      setMessage('⚠️ 知识库未满 4 份，建议补齐后再运行');
      // 不 return，继续尝试运行（让后端决定返回什么）
    }
    const skill = skillOverride ?? process?.skill?.initialVersion ?? blankSkill();
    setLoadingRun(true);
    try {
      const res = await fetch(api('/api/l2/run'), {
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
      setRunCount((prev) => Math.min(prev + 1, 3));
      if (action === 'second' && skillOverride) {
        onSave({ skill: { ...process.skill, finalVersion: skillOverride } });
      }
      // 运行成功后自动触发 AI 检查（不用学生手动点）
      setCheck(null);
      handleCheck();
    } finally {
      setLoadingRun(false);
    }
  }

  async function handleCheck() {
    setLoadingCheck(true);
    setMessage('');
    try {
      // 把当前运行结果和 Skill 一起传给后端，避免因 DB 延迟/新学生导致 400
      const res = await fetch(api('/api/l2/check'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, firstRun: run, skill: editSkill }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage(`⚠ AI 检查失败：${d.error?.message ?? '未知错误'}（运行结果已保存，可继续调整后重试）`);
        return;
      }
      setCheck(d.check);
    } finally {
      setLoadingCheck(false);
    }
  }

  function PersonaCard({ personaKey, selected, onClick, learner }: { personaKey: 'A' | 'B'; selected: boolean; onClick: () => void; learner: LearnerRunResult }) {
    const name = LEARNER_NAMES[learner.learnerId] ?? `学员${personaKey}`;
    const icon = personaKey === 'A' ? '📖' : '📚';
    const tagColor = personaKey === 'A' ? 'var(--orange)' : 'var(--blue)';
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '14px 16px',
          borderRadius: 12,
          border: selected ? `2px solid ${tagColor}` : '1px solid var(--border)',
          background: selected ? `rgba(56,189,248,0.08)` : 'var(--card)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: tagColor }}>{name}</span>
          {selected && <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 10, background: tagColor, color: '#fff' }}>查看中</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div>⏱ 训练时长：{learner.trainingDuration}</div>
          <div>🎯 训练重点：{learner.trainingFocus}</div>
        </div>
      </button>
    );
  }

  function renderLearner(l: LearnerRunResult) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--card)' }}>
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
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>（未引用具体资料）</div>
        )}
      </div>
    );
  }

  // 轮次计数：firstRun=第1轮, secondRun=第2轮（最多3轮）
  // 使用本地 runCount（每次运行成功后 +1），不依赖 process.secondRun（process 只在挂载时加载一次）
  // const round = process?.secondRun ? 2 : (run ? 1 : 0); // 已废弃，改用 runCount

  return (
    <div>
      {/* 标题 */}
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>测试你的 AI 助手</h2>
      <p className="note" style={{ marginBottom: 14 }}>左边可改知识库和 Skill，右边看运行结果和 AI 检查。最多 3 轮。</p>

      {/* 轮次进度条 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        {[1, 2, 3].map((r) => (
          <Fragment key={r}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: r < runCount ? 'var(--green)' : r === runCount ? 'var(--yellow)' : '#334155',
              color: r === runCount ? '#000' : r < runCount ? '#fff' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>{r}</div>
            {r < 3 && <div style={{ flex: 1, height: 2, background: '#334155' }} />}
          </Fragment>
        ))}
        <span style={{ marginLeft: 14, color: 'var(--muted)', fontSize: 14 }}>
          {runCount === 0 ? '待测试' : `已测试 ${runCount} / 3 轮`}
        </span>
      </div>

      {/* 左右分栏工作台 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ===== 左栏：知识库 + Skill 编辑区 ===== */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          {/* 知识库 - 可直接选/换 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              📚 知识库
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>已选 {editSelection.length} / 4</span>
            </div>
            {KNOWLEDGE_DOCS.map((d) => {
              const on = editSelection.includes(d.id);
              return (
                <div
                  key={d.id}
                  onClick={() => {
                    if (submitted) return;
                    if (on) setEditSelection(editSelection.filter((x) => x !== d.id));
                    else if (editSelection.length < 4) setEditSelection([...editSelection, d.id]);
                  }}
                  style={{
                    padding: '7px 10px', marginBottom: 4, borderRadius: 6,
                    cursor: submitted ? 'default' : 'pointer',
                    border: on ? '2px solid var(--green)' : '1px solid var(--border)',
                    background: on ? 'rgba(34,197,94,0.12)' : 'var(--dark)',
                    fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {on && <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                  <span style={{ flex: 1, color: on ? '#e2e8f0' : 'var(--muted)' }}>{d.title}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 10, flexShrink: 0 }}>{d.source}</span>
                </div>
              );
            })}
          </div>

          {/* Skill 编辑 */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              📋 Skill
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>可直接编辑</span>
            </div>
            {SKILL_BLOCKS.map((b) => (
              <div key={b.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                  {b.title}
                </label>
                <textarea
                  value={(editSkill as any)[b.key] ?? ''}
                  onChange={(e) =>
                    setEditSkill((s) => ({ ...s, [b.key]: e.target.value }))
                  }
                  style={{
                    width: '100%', minHeight: 50, background: 'var(--dark)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: '#e2e8f0', padding: 8, fontSize: 12, resize: 'vertical',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ===== 右栏：运行结果 + AI 检查 ===== */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            🤖 运行结果
            {run && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>第 {runCount} 轮</span>}
          </div>

          {!run && (
            <div className="note" style={{ padding: '40px 0', textAlign: 'center' }}>
              {loadingRun ? (
                <>
                  <div style={{
                    width: 36, height: 36, border: '3px solid var(--border)',
                    borderTopColor: 'var(--blue)', borderRadius: '50%',
                    margin: '0 auto 12px', animation: 'spin 0.9s linear infinite',
                  }} />
                  正在为两位学员生成运行结果…
                </>
              ) : (
                <>准备就绪，可点击「重新运行」开始测试</>
              )}
            </div>
          )}

          {run && (
            <>
              {/* 视图切换 */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, marginBottom: 12 }}>
                <button type="button" onClick={() => setViewMode('single')} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, background: viewMode === 'single' ? 'var(--blue)' : 'transparent',
                  color: viewMode === 'single' ? '#fff' : 'var(--muted)',
                }}>👤 单人</button>
                <button type="button" onClick={() => setViewMode('sideBySide')} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, background: viewMode === 'sideBySide' ? 'var(--blue)' : 'transparent',
                  color: viewMode === 'sideBySide' ? '#fff' : 'var(--muted)',
                }}>⬌ 并排</button>
              </div>

              {/* 单人视图：卡片+窗口 */}
              {viewMode === 'single' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <PersonaCard personaKey="A" selected={selectedPersona === 'A'} onClick={() => setSelectedPersona('A')} learner={run.learnerA} />
                    <PersonaCard personaKey="B" selected={selectedPersona === 'B'} onClick={() => setSelectedPersona('B')} learner={run.learnerB} />
                  </div>
                  <div style={{ border: '1px solid var(--blue)', borderRadius: 10, padding: 12, background: 'rgba(56,189,248,0.05)' }}>
                    {renderLearner(selectedPersona === 'A' ? run.learnerA : run.learnerB)}
                  </div>
                </>
              )}

              {/* 并排视图 */}
              {viewMode === 'sideBySide' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {renderLearner(run.learnerA)}
                  {renderLearner(run.learnerB)}
                </div>
              )}

              {run.generationMode && (
                <div className="note" style={{ fontSize: 11, marginTop: 8 }}>
                  生成方式：{run.generationMode}
                  {run.warnings?.includes('OFFLINE_EXAMPLE_RETURNED') ? '（课堂示例）' : ''}
                </div>
              )}

              {/* AI 自动检查（运行后自动触发） */}
              {!check && loadingCheck && (
                <div style={{ marginTop: 12, padding: '14px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                  <div style={{
                    width: 28, height: 28, border: '3px solid rgba(168,85,247,0.2)',
                    borderTopColor: '#a855f7', borderRadius: '50%',
                    margin: '0 auto 8px', animation: 'spin 0.9s linear infinite',
                  }} />
                  AI 正在检查你的 Skill 和运行结果…
                </div>
              )}

              {check && (
                <div style={{ marginTop: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#a855f7' }}>
                    🔍 AI 检查报告
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}>
                      {check.diagnosisType === 'knowledgeBase' ? '知识库问题' :
                       check.diagnosisType === 'skill' ? 'Skill 问题' :
                       check.diagnosisType === 'both' ? '两者都有问题' : '基本合格'}
                    </span>
                  </div>
                  <div style={{ color: '#cbd5e1', marginBottom: 8 }}>{check.overallStatus}</div>

                  {(() => {
                    const evals = check.skillEvaluation;
                    if (!evals || evals.length === 0) return null;
                    return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>🛠 Skill 逐项检查</div>
                      {evals.map((e, i) => {
                        const color = e.status === 'good' ? 'var(--green)' : e.status === 'weak' ? 'var(--yellow)' : 'var(--red)';
                        const label = e.status === 'good' ? '✓ 合格' : e.status === 'weak' ? '⚠ 偏弱' : '✗ 空/乱填';
                        return (
                          <div key={i} style={{ paddingLeft: 16, marginBottom: 4 }}>
                            <span style={{ color, fontWeight: 700 }}>{label}</span>
                            <span style={{ margin: '0 6px', color: 'var(--muted)' }}>{e.block}</span>
                            <span style={{ color: '#cbd5e1' }}>{e.comment}</span>
                          </div>
                        );
                      })}
                    </div>
                    );
                  })()}

                  {check.positiveFindings?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>✓ 做对了什么 → 产生了什么效果</div>
                      {check.positiveFindings.map((x, i) => (
                        <div key={i} style={{ paddingLeft: 16 }}>· {x}</div>
                      ))}
                    </div>
                  )}

                  {check.issues?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>✗ 没做什么 / 哪里不对 → 导致了什么问题</div>
                      {check.issues.map((x, i) => (
                        <div key={i} style={{ paddingLeft: 16 }}>· {x}</div>
                      ))}
                    </div>
                  )}

                  {check.evidence?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>📎 证据</div>
                      {check.evidence.map((x, i) => (
                        <div key={i} style={{ paddingLeft: 16, color: 'var(--muted)' }}>· {x}</div>
                      ))}
                    </div>
                  )}

                  {check.recommendations?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>🔧 建议怎么改 Skill</div>
                      {check.recommendations.map((x, i) => (
                        <div key={i} style={{ paddingLeft: 16 }}>· {x}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
                {runCount < 3 && !submitted && (
                  <>
                    <button disabled={loadingRun || loadingCheck || locked} onClick={() => {
                      // 保存当前知识库选择 + Skill，然后提交运行（运行完自动触发 AI 检查）
                      onSave({ knowledgeBase: { ...process.knowledgeBase, initialSelection: editSelection } });
                      handleRun('second', { ...editSkill }, [...editSelection]);
                    }} style={{
                      padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 700, background: 'var(--green)', color: '#fff',
                    }}>
                      {loadingRun
                        ? '运行中…'
                        : loadingCheck
                          ? 'AI 检查中…'
                          : runCount === 0
                            ? '🚀 提交测试'
                            : `🔄 重新提交（第 ${Math.min(runCount + 1, 3)} 轮）`}
                    </button>
                    {runCount > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        💡 上次填写的内容已保留，可直接修改后再次提交
                      </span>
                    )}
                  </>
                )}
                {!submitted && (
                  <button disabled={busy || locked} onClick={() => onFinish()} style={{
                    padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, background: 'var(--card)', color: '#e2e8f0',
                  }}>
                    {busy ? '提交中…' : st?.finalSubmitLabel ?? '✅ 提交最终版本'}
                  </button>
                )}
              </div>

              {/* 轮次提示 */}
              {run && runCount > 0 && runCount < 3 && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  已使用 {runCount} / 3 次测试机会 · 还可调整知识库或 Skill 后再试一次
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
