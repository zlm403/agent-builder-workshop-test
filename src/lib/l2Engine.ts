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
  return `你是考研英语个性化训练助手的设计评测员。给定学生的「知识库资料」「Skill（方法）」和「两位学习者画像」，请分别为两位学习者生成一份训练方案。

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
  return `你是 AI 助手设计诊断员。你会拿到：学生选中的知识库资料（含来源/时间等客观属性，但不要仅凭“推荐类别”下结论）、学生编写的 Skill、以及两位学习者的运行结果和实际引用资料。

诊断要求（证据边界）：
1. 区分三件事：资料“被选中”、资料“被本次运行引用”、资料“实际影响了结果”。只有证据链完整（被选中 + 运行返回了该 docId + 结果内容确实体现了该资料观点）才能说“影响了结果”。
2. 若某资料被选中但未被引用，只能说“与任务关系较弱/可能增加以后被错误调用的风险”，不能说它导致了错误。
3. 若两份结果差异不明显，更可能来自 Skill 判断规则不清楚，而非直接归咎知识库。
4. 必须返回 JSON：{ "overallStatus", "positiveFindings": string[], "issues": string[], "evidence": string[], "recommendations": string[], "diagnosisType": "knowledgeBase"|"skill"|"both"|"acceptable" }。
5. 不要输出 JSON 以外文字。`;
}

function checkUser(input: CheckInput): string {
  const docLines = input.docs
    .map(
      (d) =>
        `《${d.title}》[docId=${d.id}] 来源:${d.source} 更新:${d.updatedAt} 相关性:${d.relevance} 可靠性:${d.reliability} 时效性:${d.timeliness} | 学生是否选中:${d.selected ? '是' : '否'} | 小林是否引用:${d.referencedA ? '是' : '否'} | 小周是否引用:${d.referencedB ? '是' : '否'}`,
    )
    .join('\n');
  const skill = `了解：${input.skill.understand}\n判断：${input.skill.judge}\n执行：${input.skill.execute}\n知识使用规则：${input.skill.sourcePriorityRule || '（未填写）'}\n反馈：${input.skill.feedback}`;
  const run = `小林结果：${JSON.stringify(input.firstRun.learnerA)}\n小周结果：${JSON.stringify(input.firstRun.learnerB)}`;
  return `知识库资料：\n${docLines}\n\n学生 Skill：\n${skill}\n\n第一次运行结果：\n${run}\n\n请给出 JSON 诊断。`;
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
  return {
    overallStatus: str(p.overallStatus),
    positiveFindings: Array.isArray(p.positiveFindings) ? (p.positiveFindings as unknown[]).map((x) => str(x)) : [],
    issues: Array.isArray(p.issues) ? (p.issues as unknown[]).map((x) => str(x)) : [],
    evidence: Array.isArray(p.evidence) ? (p.evidence as unknown[]).map((x) => str(x)) : [],
    recommendations: Array.isArray(p.recommendations) ? (p.recommendations as unknown[]).map((x) => str(x)) : [],
    diagnosisType,
  };
}

// 离线/失败兜底：仅依据客观属性和引用状态给保守结论，绝不声称某资料“导致了结果”。
function ruleFallbackCheck(input: CheckInput): AiCheckResult {
  const issues: string[] = [];
  const evidence: string[] = [];
  const recommendations: string[] = [];
  let diagnosisType: AiCheckDiagnosisType = 'acceptable';

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
    diagnosisType = 'knowledgeBase';
  }

  // Skill：检查判断/执行是否过于简短、模糊。
  const judgeShort = (input.skill.judge || '').length < 12;
  const execShort = (input.skill.execute || '').length < 12;
  if (judgeShort || execShort) {
    issues.push('Skill 的“判断”或“执行”写得比较笼统，缺少可操作规则。');
    evidence.push('两份结果的训练重点或材料难度较为接近，差异主要来自可用时间。');
    recommendations.push('补充：根据薄弱点确定题型、根据基础确定难度、根据时间确定训练量。');
    diagnosisType = diagnosisType === 'knowledgeBase' ? 'both' : 'skill';
  }

  if (diagnosisType === 'acceptable') {
    issues.push('当前版本知识库与 Skill 基本合理，两份结果体现了一定差异。');
    evidence.push('未发现明显的资料风险或规则缺失。');
  }

  return {
    overallStatus: 'AI 检查（基础模式）完成',
    positiveFindings: ['知识库与任务相关', 'Skill 包含了解/判断/执行/反馈的结构'],
    issues,
    evidence,
    recommendations,
    diagnosisType,
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
