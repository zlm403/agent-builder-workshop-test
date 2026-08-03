import { prisma } from './db';

// A01 / A03 学生操作过程在 ModuleProgress.data 中的形状
export interface A01Turn {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export type PathKey = 'direct' | 'iterate' | 'workflow';
export type ArtifactKey = 'article' | 'exercise' | 'feedback' | 'workflow';

export interface DimensionFlags {
  context: boolean; // 是否说明对象/薄弱点
  task: boolean; // 是否明确任务要求
  process: boolean; // 是否设计连续过程
  verify: boolean; // 是否检查/要求依据
}

export interface A01OperationData {
  moduleId: string;
  startedAt: number;
  submittedAt?: number;
  turns: A01Turn[];
  usedMaterial: boolean;
  verified: boolean;
  modified: boolean;
  helpUsed?: boolean;
  firstUserPrompt: string;
  finalText?: string;
  framework?: Record<string, string>; // A03 第二轮：对象/任务/过程/检验 四要素填写
  dimensions?: DimensionFlags;
  pathType?: PathKey;
  artifactType?: ArtifactKey;
}

export interface StudentProfile {
  anonymousId: string;
  rounds: number;
  usedMaterial: boolean;
  verified: boolean;
  modified: boolean;
  taskClarity: 'vague' | 'medium' | 'clear';
  aiStyle: 'one_shot' | 'multi_round' | 'stepwise';
  finalText?: string;
  firstUserPrompt: string;
  dimensions: DimensionFlags;
  pathType: PathKey;
  artifactType: ArtifactKey;
}

export interface FunnelRow {
  label: string;
  count: number;
}

export interface DistributionBucket {
  label: string;
  pct: number;
}

export interface TypicalSample {
  anonymousId: string;
  category: string;
  snippet: string;
}

export interface TeachingSuggestion {
  id: string;
  severity: 'info' | 'warn' | 'good';
  title: string;
  detail: string;
  actions: string[];
}

export interface ClassAnalytics {
  total: number;
  funnel: FunnelRow[];
  taskClarity: DistributionBucket[];
  materialUsage: DistributionBucket[];
  aiStyle: DistributionBucket[];
  styleCounts?: { one_shot: number; multi_round: number; stepwise: number };
  samples: TypicalSample[];
  suggestions: TeachingSuggestion[];
  metrics: {
    entered: number;
    firstCall: number;
    usedMaterial: number;
    iterated: number;
    verified: number;
    submitted: number;
    modified: number;
  };
  dimensions: { key: keyof DimensionFlags; label: string; pct: number }[];
  pathDistribution: { key: PathKey; label: string; count: number; pct: number }[];
  artifactDistribution: { key: ArtifactKey; label: string; count: number; pct: number }[];
  classInsight: string;
  profiles: StudentProfile[];
}

const MATERIAL_KW = ['资料', '材料', '小林', '阅读', '原文', '根据', '依据'];
const VERIFY_KW = ['依据', '核对', '检查', '验证', '原文找', '能否在原文', '出处'];
const MODIFY_KW = ['修改', '调整', '重新', '改一下', '优化', '更正'];
const GOAL_KW = ['训练', '计划', '方案', '设计', '学习', '提升', '练习', '测试', '题'];
const OBJECT_KW = ['小林', '我', '学生', '他', '她', '同学', '用户', '对象', '薄弱', '长难句', '问题', '需要'];
const PROCESS_KW = ['步骤', '流程', '先', '再', '然后', '作答', '反馈', '计划', '方案', '训练'];
const ARTICLE_KW = ['文章', '材料', '阅读', '文本', '段落'];
const EXERCISE_KW = ['题', '测试', '练习', 'quiz', '问答', '填空'];
const FEEDBACK_KW = ['答案', '解析', '依据', '反馈', '批改', '讲解', '说明'];
const WORKFLOW_KW = ['流程', '步骤', '计划', '方案', '训练', '先', '再', '作答', '反馈', '检查'];

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

function classifyClarity(first: string): 'vague' | 'medium' | 'clear' {
  const len = first.trim().length;
  const hasObject = OBJECT_KW.some((k) => first.includes(k));
  const hasGoal = GOAL_KW.some((k) => first.includes(k));
  const hasMaterial = MATERIAL_KW.some((k) => first.includes(k));
  if (len < 12 && !hasObject && !hasGoal) return 'vague';
  if (hasObject && hasGoal && hasMaterial) return 'clear';
  if ((hasObject && hasGoal) || len >= 20) return 'medium';
  return 'vague';
}

const CONTINUE_RE = /^(好[,，]?\s*)?(继续|展开|详细|再说说|接着|往下|再说|多说|继续说)?\s*[。.！!]*$/;

function isIterativeTurn(content: string): boolean {
  const t = content.trim();
  if (MODIFY_KW.some((k) => t.includes(k))) return true;
  if (VERIFY_KW.some((k) => t.includes(k))) return true;
  if (MATERIAL_KW.some((k) => t.includes(k))) return true;
  if (t.length >= 8 && !CONTINUE_RE.test(t)) return true;
  return false;
}

function computeDimensions(data: A01OperationData): DimensionFlags {
  const fw = data.framework ?? {};
  const allText = (data.firstUserPrompt + ' ' + data.turns.filter((t) => t.role === 'user').map((t) => t.content).join(' ')).toLowerCase();
  const finalText = (data.finalText ?? '').toLowerCase();
  const context =
    !!fw.object && fw.object.trim().length > 0
      ? true
      : OBJECT_KW.some((k) => allText.includes(k)) || /薄弱|长难句|不会|困难/.test(allText);
  const task =
    !!fw.task && fw.task.trim().length > 0
      ? true
      : GOAL_KW.some((k) => allText.includes(k)) || GOAL_KW.some((k) => finalText.includes(k));
  const process =
    !!fw.process && fw.process.trim().length > 0
      ? true
      : PROCESS_KW.some((k) => allText.includes(k)) || data.modified;
  const verify =
    !!fw.verify && fw.verify.trim().length > 0 ? true : data.verified || VERIFY_KW.some((k) => allText.includes(k));
  return { context, task, process, verify };
}

function classifyPath(style: StudentProfile['aiStyle'], dims: DimensionFlags, hasFramework: boolean): PathKey {
  if (style === 'stepwise') return 'workflow';
  if (style === 'multi_round') return 'iterate';
  if (hasFramework && dims.process) return 'workflow';
  return 'direct';
}

function classifyArtifact(finalText: string): ArtifactKey {
  const t = (finalText ?? '').toLowerCase();
  if (FEEDBACK_KW.some((k) => t.includes(k))) return 'feedback';
  if (WORKFLOW_KW.some((k) => t.includes(k))) return 'workflow';
  if (EXERCISE_KW.some((k) => t.includes(k))) return 'exercise';
  if (ARTICLE_KW.some((k) => t.includes(k))) return 'article';
  return 'article';
}

function computeProfile(data: A01OperationData): StudentProfile {
  const userTurns = data.turns.filter((t) => t.role === 'user');
  const rounds = userTurns.length;
  const first = data.firstUserPrompt || '';
  const hasIterated = rounds >= 2 && userTurns.slice(1).some((t) => isIterativeTurn(t.content));
  const style: StudentProfile['aiStyle'] =
    !hasIterated ? 'one_shot' : data.usedMaterial && data.verified ? 'stepwise' : 'multi_round';
  const dims = data.dimensions ?? computeDimensions(data);
  const hasFramework = !!data.framework && Object.values(data.framework).some((v) => (v ?? '').trim().length > 0);
  return {
    anonymousId: '',
    rounds,
    usedMaterial: data.usedMaterial,
    verified: data.verified,
    modified: data.modified,
    taskClarity: classifyClarity(first),
    aiStyle: style,
    finalText: data.finalText,
    firstUserPrompt: first,
    dimensions: dims,
    pathType: classifyPath(style, dims, hasFramework),
    artifactType: classifyArtifact(data.finalText ?? ''),
  };
}

export function computeStudentProfile(anonymousId: string, data: A01OperationData): StudentProfile {
  return { ...computeProfile(data), anonymousId };
}

export async function computeClassAnalytics(sessionId: string, moduleId = 'A01_BASELINE'): Promise<ClassAnalytics> {
  const progresses = await prisma.moduleProgress.findMany({
    where: { sessionId, moduleId },
    include: { participant: true },
  });

  const profiles: StudentProfile[] = [];
  for (const p of progresses) {
    const d = p.data as unknown as A01OperationData | null;
    if (!d || d.moduleId !== moduleId) continue;
    profiles.push(computeProfile(d));
  }
  for (let i = 0; i < profiles.length; i++) {
    profiles[i].anonymousId = (progresses[i].participant as { anonymousId: string }).anonymousId;
  }

  const total = profiles.length;
  const entered = total;
  const firstCall = profiles.filter((p) => p.rounds >= 1).length;
  const usedMaterial = profiles.filter((p) => p.usedMaterial).length;
  const iterated = profiles.filter((p) => p.aiStyle !== 'one_shot').length;
  const verified = profiles.filter((p) => p.verified).length;
  const submitted = profiles.filter((p) => !!p.finalText).length;

  const funnel: FunnelRow[] = [
    { label: '进入任务', count: entered },
    { label: '首次调用 AI', count: firstCall },
    { label: '使用指定资料', count: usedMaterial },
    { label: '发起二次对话', count: iterated },
    { label: '主动验证内容', count: verified },
    { label: '提交最终成果', count: submitted },
  ];

  const clarityCount = (k: StudentProfile['taskClarity']) => profiles.filter((p) => p.taskClarity === k).length;
  const taskClarity: DistributionBucket[] = [
    { label: '明确对象+目标+成果', pct: pct(clarityCount('clear'), total) },
    { label: '只说明大致目标', pct: pct(clarityCount('medium'), total) },
    { label: '任务表述模糊', pct: pct(clarityCount('vague'), total) },
  ];

  const materialUsage: DistributionBucket[] = [
    { label: '明确要求依据资料', pct: pct(usedMaterial, total) },
    { label: '粘贴资料未说明用途', pct: pct(profiles.filter((p) => !p.usedMaterial && p.rounds >= 1).length, total) },
    { label: '完全未使用资料', pct: pct(profiles.filter((p) => !p.usedMaterial && p.rounds === 1).length, total) },
  ];

  const styleCount = (k: StudentProfile['aiStyle']) => profiles.filter((p) => p.aiStyle === k).length;
  const aiStyle: DistributionBucket[] = [
    { label: '一次性问答', pct: pct(styleCount('one_shot'), total) },
    { label: '多轮修改', pct: pct(styleCount('multi_round'), total) },
    { label: '分步工作流', pct: pct(styleCount('stepwise'), total) },
  ];

  const styleCounts = {
    one_shot: styleCount('one_shot'),
    multi_round: styleCount('multi_round'),
    stepwise: styleCount('stepwise'),
  };

  // ===== 四维度（对象/任务/过程/检验）=====
  const dimCount = (k: keyof DimensionFlags) => profiles.filter((p) => p.dimensions[k]).length;
  const dimensions = [
    { key: 'context' as const, label: '结合了个人薄弱点', pct: pct(dimCount('context'), total) },
    { key: 'task' as const, label: '明确了任务要求', pct: pct(dimCount('task'), total) },
    { key: 'process' as const, label: '设计了连续过程', pct: pct(dimCount('process'), total) },
    { key: 'verify' as const, label: '检查过 AI 结果', pct: pct(dimCount('verify'), total) },
  ];

  // ===== 路径分布 =====
  const pathCount = (k: PathKey) => profiles.filter((p) => p.pathType === k).length;
  const pathDistribution = [
    { key: 'direct' as PathKey, label: '路径一 · 直接生成', count: pathCount('direct'), pct: pct(pathCount('direct'), total) },
    { key: 'iterate' as PathKey, label: '路径二 · 迭代改进', count: pathCount('iterate'), pct: pct(pathCount('iterate'), total) },
    { key: 'workflow' as PathKey, label: '路径三 · 设计流程', count: pathCount('workflow'), pct: pct(pathCount('workflow'), total) },
  ];

  // ===== 成果类型分布 =====
  const artifactLabel: Record<ArtifactKey, string> = {
    article: '阅读材料 / 文章',
    exercise: '练习题 / 测试题',
    feedback: '含答案与解析',
    workflow: '可执行训练流程',
  };
  const artifactCount = (k: ArtifactKey) => profiles.filter((p) => p.artifactType === k).length;
  const artifactDistribution = (['article', 'exercise', 'feedback', 'workflow'] as ArtifactKey[]).map((k) => ({
    key: k,
    label: artifactLabel[k],
    count: artifactCount(k),
    pct: pct(artifactCount(k), total),
  }));

  // ===== 本班发现（基于真实数据生成）=====
  const ctxPct = pct(dimCount('context'), total);
  const taskPct = pct(dimCount('task'), total);
  const procPct = pct(dimCount('process'), total);
  const verPct = pct(dimCount('verify'), total);
  let classInsight = '提交仍在统计中，稍后生成本班发现。';
  if (total >= 2) {
    if (taskPct >= ctxPct + 15) {
      classInsight = `约 ${taskPct}% 的同学都告诉了 AI 要“生成什么”，但只有 ${ctxPct}% 说明了自己具体哪里不会——这正是同一个 AI 产生不同结果的关键。`;
    } else if (verPct < 30) {
      classInsight = `只有 ${verPct}% 的同学主动检查了 AI 结果的依据；多数人直接接受了生成内容。`;
    } else if (procPct >= 50) {
      classInsight = `约 ${procPct}% 的同学设计了连续过程（生成→作答→反馈→检查），而非一次性要答案。`;
    } else {
      classInsight = `大家在“任务要求”上接近（${taskPct}%），但在“对象分析”(${ctxPct}%) 与“结果检验”(${verPct}%) 上差异明显。`;
    }
  }

  // 典型样本（匿名）
  const samples: TypicalSample[] = [];
  const vague = profiles.find((p) => p.taskClarity === 'vague');
  if (vague) samples.push({ anonymousId: vague.anonymousId, category: '任务过泛', snippet: vague.firstUserPrompt });
  const noVerify = profiles.find((p) => p.usedMaterial && !p.verified);
  if (noVerify) samples.push({ anonymousId: noVerify.anonymousId, category: '用了资料但无检验', snippet: noVerify.firstUserPrompt });
  const wf = profiles.find((p) => p.pathType === 'workflow');
  if (wf) samples.push({ anonymousId: wf.anonymousId, category: '形成训练流程', snippet: wf.firstUserPrompt });

  const suggestions: TeachingSuggestion[] = [];
  if (total >= 2) {
    if (verPct < 30) {
      suggestions.push({
        id: 'verify',
        severity: 'warn',
        title: '建议讲解“检验”',
        detail: `仅 ${verPct}% 主动检查 AI 结果的依据。`,
        actions: ['演示要求 AI 逐项说明依据', '练习核对测试题能否在原文找到出处'],
      });
    }
    if (ctxPct < 40) {
      suggestions.push({
        id: 'context',
        severity: 'warn',
        title: '建议讲解“对象”',
        detail: `仅 ${ctxPct}% 说明了学习者的具体薄弱点。`,
        actions: ['提问：AI 不知道“谁”在用，能设计到位吗？'],
      });
    }
    if (styleCounts.one_shot > total / 2) {
      suggestions.push({
        id: 'decompose',
        severity: 'info',
        title: '班级偏一次性问答',
        detail: `较多同学只进行了一轮对话。`,
        actions: ['演示诊断→设计→生成→检查的分步'],
      });
    }
  }
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'wait',
      severity: 'info',
      title: '数据采集中',

      detail: '当进入任务的学生达到一定数量后，系统会给出教学建议。',
      actions: ['继续观察全班进度'],
    });
  }

  return {
    total,
    funnel,
    taskClarity,
    materialUsage,
    aiStyle,
    styleCounts,
    samples,
    suggestions,
    metrics: { entered, firstCall, usedMaterial, iterated, verified, submitted, modified: profiles.filter((p) => p.modified).length },
    dimensions,
    pathDistribution,
    artifactDistribution,
    classInsight,
    profiles,
  };
}

// 两轮对比：返回每个维度/路径/成果类型 的 before→after 变化
export interface RoundComparison {
  dimensions: { key: keyof DimensionFlags; label: string; before: number; after: number; delta: number }[];
  pathBefore: Record<PathKey, number>;
  pathAfter: Record<PathKey, number>;
  artifactBefore: Record<ArtifactKey, number>;
  artifactAfter: Record<ArtifactKey, number>;
}

export function compareRounds(before: ClassAnalytics, after: ClassAnalytics): RoundComparison {
  const dimBefore = Object.fromEntries(before.dimensions.map((d) => [d.key, d.pct])) as Record<keyof DimensionFlags, number>;
  const dimAfter = Object.fromEntries(after.dimensions.map((d) => [d.key, d.pct])) as Record<keyof DimensionFlags, number>;
  const dimensions = (['context', 'task', 'process', 'verify'] as (keyof DimensionFlags)[]).map((key) => ({
    key,
    label: before.dimensions.find((d) => d.key === key)?.label ?? key,
    before: dimBefore[key] ?? 0,
    after: dimAfter[key] ?? 0,
    delta: (dimAfter[key] ?? 0) - (dimBefore[key] ?? 0),
  }));
  const pathBefore = Object.fromEntries(before.pathDistribution.map((p) => [p.key, p.pct])) as Record<PathKey, number>;
  const pathAfter = Object.fromEntries(after.pathDistribution.map((p) => [p.key, p.pct])) as Record<PathKey, number>;
  const artifactBefore = Object.fromEntries(before.artifactDistribution.map((a) => [a.key, a.pct])) as Record<ArtifactKey, number>;
  const artifactAfter = Object.fromEntries(after.artifactDistribution.map((a) => [a.key, a.pct])) as Record<ArtifactKey, number>;
  return { dimensions, pathBefore, pathAfter, artifactBefore, artifactAfter };
}

export async function getStudentAiStyle(anonymousId: string, sessionId: string): Promise<string | null> {
  const mp = await prisma.moduleProgress.findFirst({
    where: { sessionId, participant: { anonymousId }, moduleId: 'A01_BASELINE' },
    include: { participant: true },
  });
  if (!mp) return null;
  const d = mp.data as unknown as A01OperationData | null;
  if (!d || d.moduleId !== 'A01_BASELINE') return null;
  return computeProfile(d).aiStyle;
}
