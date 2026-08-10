// 第二关引擎：双跑生成 + AI 检查，含三级降级与离线兜底。
// 设计约束（见方案决策）：
// 1. 引用必须真实：模型只能返回学生实际选中的 docId，否则过滤并记录异常，绝不反推/伪造。
// 2. 三级生成：primary → fast-fallback（快速模型，真实数据）→ offline-example（双方均失败，明确标注示例）。
// 3. AI 检查证据边界：selected ≠ referenced ≠ affected；无完整证据链只能说“未确认影响”。

import { chatWithLLM } from './llm';
import { getLLMConfig } from './serverEnv';
import type {
  AiCheckDiagnosisType,
  AiCheckResult,
  DualRunResponse,
  GenerationMode,
  LearnerRunResult,
  RunReference,
  SkillBlockEval,
  SkillBlockStatus,
  SkillVersion,
} from './types';

const PRIMARY_TIMEOUT = 7000;
const FAST_TIMEOUT = 7000;

// ---------------------------------------------------------------------------
// 输入类型
// ---------------------------------------------------------------------------
export interface DualRunDocInput {
  id: string;
  title: string;
  body: string;
}

export interface DualRunPersonaInput {
  id: string;
  name: string;
  base: string;
  mainProblem: string;
  weakType: string;
  availableTime: string;
  goal: string;
  preference: string;
}

export interface DualRunInput {
  knowledgeDocs: DualRunDocInput[];
  skill: SkillVersion;
  personas: DualRunPersonaInput[];
}

export interface CheckDocInput {
  id: string;
  title: string;
  source: string;
  updatedAt: string;
  relevance: string;
  reliability: string;
  timeliness: string;
  selected: boolean;
  referencedA: boolean;
  referencedB: boolean;
  usageA?: string;
  usageB?: string;
}

export interface CheckInput {
  docs: CheckDocInput[];
  skill: SkillVersion;
  firstRun: { learnerA: LearnerRunResult; learnerB: LearnerRunResult };
}

// ---------------------------------------------------------------------------
// JSON 解析（兼容 ```json 代码块）
// ---------------------------------------------------------------------------
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  throw new Error('无法解析模型返回的 JSON');
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

// 过滤非法引用：只保留学生实际选中的 docId；其余记录并丢弃。
function sanitizeReferences(raw: unknown, allowedIds: string[]): { refs: RunReference[]; warned: boolean } {
  const allowed = new Set(allowedIds);
  const arr = Array.isArray(raw) ? raw : [];
  const refs: RunReference[] = [];
  let warned = false;
  for (const item of arr) {
    const docId = str((item as Record<string, unknown>)?.docId);
    if (!docId) continue;
    if (!allowed.has(docId)) {
      warned = true; // 模型返回了未选中资料
      continue;
    }
    refs.push({
      docId,
      usage: str((item as Record<string, unknown>)?.usage),
      evidence: str((item as Record<string, unknown>)?.evidence),
    });
  }
  return { refs, warned };
}

function buildLearner(obj: unknown, allowedIds: string[]): { result: LearnerRunResult; warned: boolean } {
  const o = (obj ?? {}) as Record<string, unknown>;
  const { refs, warned } = sanitizeReferences(o.references, allowedIds);
  return {
    result: {
      learnerId: str(o.learnerId),
      trainingFocus: str(o.trainingFocus),
      materialDifficulty: str(o.materialDifficulty),
      trainingTask: str(o.trainingTask),
      trainingDuration: str(o.trainingDuration),
      feedbackMethod: str(o.feedbackMethod),
      references: refs,
    },
    warned,
  };
}

// ---------------------------------------------------------------------------
// 双跑：模型调用
// ---------------------------------------------------------------------------
function dualRunSystem(): string {
  return `你是英语个性化学习助手的设计评测员。给定学生的「知识库资料」「Skill（方法）」和「两位学习者画像」，请分别为两位学习者生成一份训练方案。

严格要求：
1. 必须返回 JSON，结构为 { "learnerA": {...}, "learnerB": {...} }。
2. 每位学习者的对象包含：trainingFocus, materialDifficulty, trainingTask, trainingDuration, feedbackMethod（均为中文短语），以及 references 数组。
3. references 中的 docId 必须且只能是我在「可用资料」中列出的 id；若你没有实际依据某份资料，就不要放入 references；严禁编造 id。
4. 两份方案必须体现两位学习者基础、薄弱点、可用时间和目标的真实差异，而不是只有时间不同。
5. 不要输出任何 JSON 以外的说明文字。`;
}

function dualRunUser(input: DualRunInput): string {
  const docs = input.knowledgeDocs
    .map((d, i) => `资料${i + 1} [docId=${d.id}]《${d.title}》：${d.body}`)
    .join('\n');
  const skill = `了解：${input.skill.understand}\n判断：${input.skill.judge}\n执行：${input.skill.execute}\n知识使用规则：${input.skill.sourcePriorityRule || '（未填写）'}\n反馈：${input.skill.feedback}`;
  const personas = input.personas
    .map(
      (p) =>
        `${p.name}：${p.id}（基础${p.base}；主要问题：${p.mainProblem}；薄弱题型：${p.weakType}；可用时间：${p.availableTime}；目标：${p.goal}；偏好：${p.preference}）`,
    )
    .join('\n');
  const allowed = input.knowledgeDocs.map((d) => d.id).join('、');
  return `可用资料（references 只能用这些 docId）：\n${docs}\n\n学生的 Skill（方法）：\n${skill}\n\n两位学习者：\n${personas}\n\n请按要求返回 JSON。`;
}

async function callDualRunModel(input: DualRunInput, mode: 'primary' | 'fast'): Promise<DualRunResponse | null> {
  const config = getLLMConfig();
  const allowedIds = input.knowledgeDocs.map((d) => d.id);
  const model = mode === 'fast' ? config.fastModel : config.model;
  const maxTokens = mode === 'fast' ? 1400 : 2200;
  const timeoutMs = mode === 'fast' ? FAST_TIMEOUT : PRIMARY_TIMEOUT;
  const text = await chatWithLLM(
    [{ role: 'user', content: dualRunUser(input) }],
    dualRunSystem(),
    { json: true, model, maxTokens, timeoutMs },
  );
  const parsed = extractJson(text) as Record<string, unknown>;
  const a = buildLearner(parsed.learnerA, allowedIds);
  const b = buildLearner(parsed.learnerB, allowedIds);
  const warnings: string[] = [];
  if (a.warned || b.warned) warnings.push('MODEL_RETURNED_UNAVAILABLE_REFERENCE');
  const generationMode: GenerationMode = mode === 'fast' ? 'fast-fallback' : 'primary';
  return {
    runId: `run_${Date.now()}`,
    generationMode,
    learnerA: { ...a.result, learnerId: input.personas[0]?.id ?? a.result.learnerId },
    learnerB: { ...b.result, learnerId: input.personas[1]?.id ?? b.result.learnerId },
    warnings,
  };
}

// 离线（无 API Key）本地生成：真实使用学生选中资料 + Skill + 画像，不伪造。
function localDualRun(input: DualRunInput): DualRunResponse {
  const allowedIds = input.knowledgeDocs.map((d) => d.id);
  const coreIds = allowedIds.filter((id) => !['doc7', 'doc8'].includes(id));
  const riskIds = allowedIds.filter((id) => ['doc7', 'doc8'].includes(id));
  const buildFor = (p: DualRunPersonaInput): LearnerRunResult => {
    const refs: RunReference[] = [
      ...coreIds.map((docId) => ({ docId, usage: '作为训练安排的依据', evidence: '' })),
    ];
    if (riskIds.length) {
      refs.push({ docId: riskIds[0], usage: '被采用为训练观点', evidence: '结果中体现了该资料的观点' });
    }
    const weakFocus =
      p.weakType.includes('细节') || p.weakType.includes('定位')
        ? '生词识别与细节定位'
        : '推理判断与作者态度';
    const difficulty = p.base === '较弱' ? '较短、话题熟悉的文章，难度适中偏低' : '较长、逻辑复杂的文章，难度偏高';
    const task =
      p.base === '较弱'
        ? '限时完成 1 篇短阅读，每题标注原文依据'
        : '完成 1 篇长阅读 + 1 道推理/态度分析题';
    const feedback =
      p.id === 'zhou'
        ? '逐题解释错误选项为何不对，并引用原文'
        : '指出错因并给出下一步训练建议';
    return {
      learnerId: p.id,
      trainingFocus: `${weakFocus}（对应：${p.mainProblem}）`,
      materialDifficulty: difficulty,
      trainingTask: task,
      trainingDuration: p.availableTime,
      feedbackMethod: feedback,
      references: refs,
    };
  };
  return {
    runId: `local_${Date.now()}`,
    generationMode: 'primary',
    learnerA: buildFor(input.personas[0]),
    learnerB: buildFor(input.personas[1]),
    warnings: ['LOCAL_DEMO_NO_LLM'],
  };
}

// Level 3：双方均失败，返回明确为“课堂示例”的结果（页面会标注非学生成果）。
function offlineExampleDualRun(input: DualRunInput): DualRunResponse {
  const mk = (p: DualRunPersonaInput, focus: string, difficulty: string, task: string, feedback: string): LearnerRunResult => ({
    learnerId: p.id,
    trainingFocus: focus,
    materialDifficulty: difficulty,
    trainingTask: task,
    trainingDuration: p.availableTime,
    feedbackMethod: feedback,
    references: [],
  });
  return {
    runId: `example_${Date.now()}`,
    generationMode: 'offline-example',
    learnerA: mk(
      input.personas[0],
      '示例：生词识别与细节定位',
      '示例：较短文章',
      '示例：限时短篇阅读',
      '示例：错因 + 下一步建议',
    ),
    learnerB: mk(
      input.personas[1],
      '示例：推理与作者态度',
      '示例：较长文章',
      '示例：长阅读 + 分析题',
      '示例：逐题解释错误选项',
    ),
    warnings: ['OFFLINE_EXAMPLE_RETURNED'],
  };
}

export async function generateDualRun(input: DualRunInput): Promise<DualRunResponse> {
  const config = getLLMConfig();
  if (!config.apiKey) {
    return localDualRun(input);
  }
  try {
    const primary = await callDualRunModel(input, 'primary');
    if (primary) return primary;
  } catch {
    /* fallthrough */
  }
  try {
    const fast = await callDualRunModel(input, 'fast');
    if (fast) return fast;
  } catch {
    /* fallthrough */
  }
  return offlineExampleDualRun(input);
}

// ---------------------------------------------------------------------------
// AI 检查：模型调用
// ---------------------------------------------------------------------------
function checkSystem(): string {
  return `你是 AI 助手设计诊断员。你会拿到：学生选中的知识库资料、学生编写的 Skill（了解/判断/执行/反馈 四块）、以及两位学习者（小林/小周）的运行结果和实际引用资料。

你的任务：按下面顺序做三件事检查，再给一个综合结论。Skill 是否被认真填写是本关最关键的诊断点。

【检查顺序与重点】
1) 检查运行结果：两份结果是否真的“因 Skill 而不同”？重点看训练重点/材料难度/训练任务/反馈方式，是否针对各自情况（基础强弱、可用时间、薄弱点）做了差异化安排；还是只是套了不同的人名、差异很小，且差异来自通用人格模板而非 Skill 指令。
2) 检查 Skill（最关键）：逐块评估 了解/判断/执行/反馈 是否填写、是否具体可操作、是否与英语训练任务相关。
   - 若某块为空、或明显是乱填/与英语训练无关的内容 → 必须判定为“未生效”，并在 issues 直接写出：“Skill 的【X】是空的/乱填的，AI 没有收到相关指令，只能靠通用模板生成，所以结果看不出差别。”
   - 若某块很短、笼统（少于 15 字、没有可判断/可执行的规则）→ 判定为“弱”，指出它导致哪部分结果缺乏针对性。
3) 检查知识库：选中资料是否可靠（来源/时效）、是否被本次运行引用、是否真正影响结果。只有证据链完整（被选中 + 被引用 + 结果体现其观点）才能说“影响了结果”；被选中但未被引用只能说“关系较弱/有被误用风险”。不要仅凭“推荐类别”下结论。

【输出要求】
- 必须返回 JSON，字段如下：
  overallStatus: string（一句话综合结论，点明 运行结果 / Skill / 知识库 三方面分别怎样，最严重的短板是什么）
  positiveFindings: string[]（确实做对了的地方）
  issues: string[]（没做/做错的地方，Skill 空或乱填必须写清楚）
  evidence: string[]（支撑判断的证据）
  recommendations: string[]（具体怎么改 Skill）
  diagnosisType: "knowledgeBase" | "skill" | "both" | "acceptable"
  skillEvaluation: [{ block: "了解"|"判断"|"执行"|"反馈", status: "good"|"weak"|"empty", comment: string }]
- 若 Skill 有任何一块为 empty 或 weak，diagnosisType 必须包含 "skill"（即 "skill" 或 "both"）。
- 不要输出 JSON 以外的文字。`;
}

function checkUser(input: CheckInput): string {
  const docLines = input.docs
    .map(
      (d) =>
        `《${d.title}》[docId=${d.id}] 来源:${d.source} 更新:${d.updatedAt} 相关性:${d.relevance} 可靠性:${d.reliability} 时效性:${d.timeliness} | 学生是否选中:${d.selected ? '是' : '否'} | 小林是否引用:${d.referencedA ? '是' : '否'} | 小周是否引用:${d.referencedB ? '是' : '否'}`,
    )
    .join('\n');

  // Skill 逐块展示，并标注空/过短，方便模型直接识别乱填。
  const skillBlocks: [string, string | undefined][] = [
    ['了解', input.skill.understand],
    ['判断', input.skill.judge],
    ['执行', input.skill.execute],
    ['知识使用规则', input.skill.sourcePriorityRule],
    ['反馈', input.skill.feedback],
  ];
  const skillLines = skillBlocks
    .map(([name, val]) => {
      const v = (val || '').trim();
      const flag = v.length === 0 ? '【空】' : v.length < 15 ? '【过短/笼统】' : '';
      return `· ${name}：${v || '（未填写）'} ${flag}`;
    })
    .join('\n');
  const emptyCount = skillBlocks.filter(([, v]) => !(v || '').trim()).length;
  const skillSummary = `Skill 填写情况：共 ${skillBlocks.length} 块，空白 ${emptyCount} 块。` +
    (emptyCount > 0 ? ' 空白块意味着学生没有给 AI 任何相关指令，结果几乎必然是通用模板。' : '');

  const run = `小林结果：${JSON.stringify(input.firstRun.learnerA)}\n小周结果：${JSON.stringify(input.firstRun.learnerB)}`;
  return `知识库资料：\n${docLines}\n\n学生 Skill：\n${skillLines}\n${skillSummary}\n\n第一次运行结果：\n${run}\n\n请按顺序检查：①运行结果是否因 Skill 而不同 ②Skill 四块是否填写/具体/相关（空或乱填必须明确指出）③知识库是否可靠且被引用。给出 JSON 诊断，skillEvaluation 逐块评估。`;
}

async function callCheckModel(input: CheckInput): Promise<AiCheckResult> {
  const text = await chatWithLLM([{ role: 'user', content: checkUser(input) }], checkSystem(), {
    json: true,
    maxTokens: 1600,
    timeoutMs: PRIMARY_TIMEOUT,
  });
  const p = extractJson(text) as Record<string, unknown>;
  const dt = str(p.diagnosisType, 'acceptable');
  const diagnosisType: AiCheckDiagnosisType =
    dt === 'knowledgeBase' || dt === 'skill' || dt === 'both' || dt === 'acceptable' ? dt : 'acceptable';

  const rawEval = Array.isArray(p.skillEvaluation) ? (p.skillEvaluation as unknown[]) : [];
  const skillEvaluation: SkillBlockEval[] = rawEval
    .map((x) => {
      const o = x as Record<string, unknown>;
      const st = str(o.status);
      const status: SkillBlockStatus =
        st === 'good' || st === 'weak' || st === 'empty' ? st : 'weak';
      return { block: (['了解', '判断', '执行', '反馈'].includes(str(o.block)) ? str(o.block) : '了解') as SkillBlockEval['block'], status, comment: str(o.comment) };
    })
    .filter((e) => ['了解', '判断', '执行', '反馈'].includes(e.block));

  return {
    overallStatus: str(p.overallStatus),
    positiveFindings: Array.isArray(p.positiveFindings) ? (p.positiveFindings as unknown[]).map((x) => str(x)) : [],
    issues: Array.isArray(p.issues) ? (p.issues as unknown[]).map((x) => str(x)) : [],
    evidence: Array.isArray(p.evidence) ? (p.evidence as unknown[]).map((x) => str(x)) : [],
    recommendations: Array.isArray(p.recommendations) ? (p.recommendations as unknown[]).map((x) => str(x)) : [],
    diagnosisType,
    skillEvaluation: skillEvaluation.length ? skillEvaluation : undefined,
  };
}

// 离线/失败兜底：依据客观属性、引用状态与 Skill 各块填写情况给保守结论，绝不声称某资料“导致了结果”。
function ruleFallbackCheck(input: CheckInput): AiCheckResult {
  const issues: string[] = [];
  const evidence: string[] = [];
  const recommendations: string[] = [];
  const positiveFindings: string[] = [];
  const skillEvaluation: SkillBlockEval[] = [];
  let diagnosisType: AiCheckDiagnosisType = 'acceptable';

  positiveFindings.push('知识库资料与英语训练任务相关');

  // Skill：逐块检查 了解/判断/执行/反馈 是否空或过于简短。
  const blocks: [keyof SkillVersion, SkillBlockEval['block']][] = [
    ['understand', '了解'],
    ['judge', '判断'],
    ['execute', '执行'],
    ['feedback', '反馈'],
  ];
  let skillBad = false;
  for (const [key, name] of blocks) {
    const v = (input.skill[key] || '').trim();
    if (v.length === 0) {
      skillEvaluation.push({ block: name, status: 'empty', comment: '这一块是空的，AI 没收到任何相关指令，只能靠通用模板生成，所以结果看不出差别。' });
      issues.push(`Skill 的「${name}」是空的——AI 没收到指令，结果差异主要来自通用模板而非你的设计。`);
      skillBad = true;
    } else if (v.length < 15) {
      skillEvaluation.push({ block: name, status: 'weak', comment: '写得太短、太笼统，缺少可操作规则，导致这一环节缺乏针对性。' });
      issues.push(`Skill 的「${name}」写得太笼统（不足 15 字），没有可判断/可执行的规则。`);
      skillBad = true;
    } else {
      skillEvaluation.push({ block: name, status: 'good', comment: '已填写且较具体。' });
    }
  }
  if (skillBad) {
    evidence.push('两份结果的训练重点/难度/反馈较为接近，差异主要来自通用人格模板而非 Skill 指令，说明 Skill 未真正生效。');
    recommendations.push(
      '把空的/笼统的 Skill 块补全：了解→写清要收集小林/小周的哪些信息（基础、薄弱点、可用时间）；判断→写清根据什么区分两人；执行→写清从知识库选什么、怎么安排；反馈→写清怎样给有针对性、有证据的反馈。',
    );
    diagnosisType = 'skill';
  } else {
    positiveFindings.push('Skill 四个区块均已填写，具备基本结构');
  }

  // 知识库：仅基于被选中的低可靠性/低时效资料的“客观属性”提示风险，但不声称影响结果。
  const weakSelected = input.docs.filter(
    (d) => d.selected && (d.reliability === '低' || d.timeliness === '低' || d.timeliness === '未知'),
  );
  const weakReferenced = weakSelected.filter((d) => d.referencedA || d.referencedB);
  if (weakSelected.length) {
    issues.push(
      `知识库中包含了来源或时效偏弱的资料（如《${weakSelected.map((d) => d.title).join('》《')}》）。`,
    );
    evidence.push(
      weakReferenced.length
        ? `其中《${weakReferenced.map((d) => d.title).join('》《')}》被本次运行引用；但无法仅凭此确认它实际改变了结果，需结合结果内容判断。`
        : '这些资料本次未被运行引用，但继续保留可能增加以后被错误调用的风险。',
    );
    recommendations.push('可考虑移除来源或时效偏弱的资料，改用更可靠的核心资料。');
    diagnosisType = diagnosisType === 'skill' ? 'both' : 'knowledgeBase';
  }

  if (diagnosisType === 'acceptable') {
    issues.push('当前版本知识库与 Skill 基本合理，两份结果体现了一定差异。');
    evidence.push('未发现明显的资料风险或规则缺失。');
  }

  const overall =
    diagnosisType === 'skill'
      ? 'AI 检查：Skill 填写有明显问题，运行结果未能体现你的设计。'
      : diagnosisType === 'both'
        ? 'AI 检查：Skill 与知识库都有问题，运行结果受两方面影响。'
        : diagnosisType === 'knowledgeBase'
          ? 'AI 检查（基础模式）完成：Skill 基本可用，知识库有风险点。'
          : 'AI 检查（基础模式）完成：知识库与 Skill 基本合理。';

  return {
    overallStatus: overall,
    positiveFindings,
    issues,
    evidence,
    recommendations,
    diagnosisType,
    skillEvaluation,
  };
}

export async function generateAiCheck(input: CheckInput): Promise<AiCheckResult> {
  const config = getLLMConfig();
  if (!config.apiKey) {
    return ruleFallbackCheck(input);
  }
  try {
    return await callCheckModel(input);
  } catch {
    /* fallthrough */
  }
  try {
    const fast = await callCheckModel(input);
    return fast;
  } catch {
    /* fallthrough */
  }
  return ruleFallbackCheck(input);
}
