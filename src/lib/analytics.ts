import { prisma } from './db';

// A01 学生操作过程在 ModuleProgress.data 中的形状
export interface A01Turn {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export interface A01OperationData {
  moduleId: 'A01_BASELINE';
  startedAt: number;
  submittedAt?: number;
  turns: A01Turn[];
  usedMaterial: boolean; // 引用了给定资料 / 要求 AI 依据材料
  verified: boolean; // 要求核对 / 验证 / 依据原文
  modified: boolean; // 要求修改 / 调整
  finalText?: string;
  firstUserPrompt: string;
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
  profiles: StudentProfile[];
  metrics: {
    entered: number;
    firstCall: number;
    usedMaterial: number;
    iterated: number;
    verified: number;
    submitted: number;
  };
}

const MATERIAL_KW = ['资料', '材料', '小林', '阅读', '原文', '根据', '依据'];
const VERIFY_KW = ['依据', '核对', '检查', '验证', '原文找', '能否在原文', '出处'];
const MODIFY_KW = ['修改', '调整', '重新', '改一下', '优化', '更正'];
const GOAL_KW = ['训练', '计划', '方案', '设计', '学习', '提升', '练习'];

function classifyClarity(first: string): 'vague' | 'medium' | 'clear' {
  const len = first.trim().length;
  const hasObject = /小林|我|学生|他|她|同学|用户/.test(first);
  const hasGoal = GOAL_KW.some((k) => first.includes(k));
  const hasMaterial = MATERIAL_KW.some((k) => first.includes(k));
  if (len < 12 && !hasObject && !hasGoal) return 'vague';
  if (hasObject && hasGoal && hasMaterial) return 'clear';
  if ((hasObject && hasGoal) || len >= 20) return 'medium';
  return 'vague';
}

// 仅用于“续话/空转”识别：像“继续”“好 继续”“详细点”这类不含新意图的短句
const CONTINUE_RE = /^(好[,，]?\s*)?(继续|展开|详细|再说说|接着|往下|再说|多说|继续说)?\s*[。.！!]*$/;

// 判断一条后续用户消息是否具有“实质性迭代意图”，而非空转续话
function isIterativeTurn(content: string): boolean {
  const t = content.trim();
  if (MODIFY_KW.some((k) => t.includes(k))) return true; // 明确要求修改/调整
  if (VERIFY_KW.some((k) => t.includes(k))) return true; // 明确要求核对/验证
  if (MATERIAL_KW.some((k) => t.includes(k))) return true; // 又补充了资料/依据
  if (t.length >= 8 && !CONTINUE_RE.test(t)) return true; // 不是纯续话且有实质内容
  return false;
}

function computeProfile(data: A01OperationData): StudentProfile {
  const userTurns = data.turns.filter((t) => t.role === 'user');
  const rounds = userTurns.length;
  const first = data.firstUserPrompt || '';
  // 真正的“二次迭代/修改” = 不止一轮，且后续轮次存在实质性交互（修改/验证意图或新资料/指令），
  // 而非“继续”“好”这类空转续话。只有实质迭代才计入 iterated，并归为多轮/分步风格。
  const hasIterated = rounds >= 2 && userTurns.slice(1).some((t) => isIterativeTurn(t.content));
  const style: StudentProfile['aiStyle'] =
    !hasIterated
      ? 'one_shot'
      : data.usedMaterial && data.verified
        ? 'stepwise'
        : 'multi_round';
  return {
    anonymousId: '', // 由调用方填充
    rounds,
    usedMaterial: data.usedMaterial,
    verified: data.verified,
    modified: data.modified,
    taskClarity: classifyClarity(first),
    aiStyle: style,
    finalText: data.finalText,
    firstUserPrompt: first,
  };
}

export function computeStudentProfile(
  anonymousId: string,
  data: A01OperationData,
): StudentProfile {
  return { ...computeProfile(data), anonymousId };
}

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

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
  // 回填 anonymousId
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

  // 典型样本（匿名）
  const samples: TypicalSample[] = [];
  const vague = profiles.find((p) => p.taskClarity === 'vague');
  if (vague) samples.push({ anonymousId: vague.anonymousId, category: '任务过泛', snippet: vague.firstUserPrompt });
  const noBoundary = profiles.find((p) => p.usedMaterial && !p.verified);
  if (noBoundary) samples.push({ anonymousId: noBoundary.anonymousId, category: '用了资料但无边界', snippet: noBoundary.firstUserPrompt });
  const stepwise = profiles.find((p) => p.aiStyle === 'stepwise');
  if (stepwise) samples.push({ anonymousId: stepwise.anonymousId, category: '形成分步思路', snippet: stepwise.firstUserPrompt });

  // 教学建议（规则驱动，教师确认后执行）。阈值对小班级也敏感，便于演示。
  const suggestions: TeachingSuggestion[] = [];
  if (total >= 2) {
    if (pct(usedMaterial, total) < 60) {
      suggestions.push({
        id: 'material',
        severity: 'warn',
        title: '建议重点讲解「资料依据」',
        detail: `当前有 ${100 - pct(usedMaterial, total)}% 的学生没有使用给定材料，或没有要求 AI 依据材料完成任务。`,
        actions: ['投放使用/未使用资料的对比案例', '追加 3 分钟资料边界讲解', '用案例做匿名复盘'],
      });
    }
    if (pct(styleCount('one_shot'), total) > 45) {
      suggestions.push({
        id: 'decompose',
        severity: 'warn',
        title: '建议讲解任务拆解',
        detail: `当前有 ${pct(styleCount('one_shot'), total)}% 的学生只进行了一轮对话。`,
        actions: ['提问：若 AI 第一步就理解错，后续内容还有价值吗？', '演示诊断→设计→生成→检查的分步'],
      });
    }
    if (pct(verified, total) < 30 && pct(iterated, total) >= 30) {
      suggestions.push({
        id: 'verify',
        severity: 'info',
        title: '可压缩基础提问，进入验证',
        detail: `当前 ${pct(iterated, total)}% 完成了多轮修改，但仅 ${pct(verified, total)}% 主动检查内容依据。`,
        actions: ['演示要求 AI 逐项说明依据', '练习核对测试题能否在原文找到出处'],
      });
    }
    if (pct(styleCount('stepwise'), total) >= 35 && pct(usedMaterial, total) >= 50) {
      suggestions.push({
        id: 'advanced',
        severity: 'good',
        title: '班级基础高于预设',
        detail: '较多学生已具备资料边界与分步意识。',
        actions: ['缩短 A03 基础讲解', '提前进入越界测试', '开启高级挑战任务'],
      });
    }
    if (submitted > 0 && pct(submitted, total) < 50 && entered >= 2) {
      suggestions.push({
        id: 'stuck',
        severity: 'warn',
        title: '班级整体偏慢',
        detail: '当前完成速度低于预期，可能任务说明理解不足或资料过长。',
        actions: ['暂停计时', '再次澄清最终成果', '延长 3 分钟', '不提供具体提示词，只澄清任务要求'],
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
    metrics: { entered, firstCall, usedMaterial, iterated, verified, submitted },
    profiles,
  };
}

// 读取单个学员在 A01 的实操分类，用于学生端 A02/A03 个性化内容。
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
