// AI 标签判定引擎（确定性规则版，离线演示稳定）。
// 设计：一个主问题 + 一次针对性追问，最后给一张“当前 AI 标签”反馈卡。
// 后续接入真实 LLM 时，只需替换 judgeAnswer / buildFollowup / refineJudgment 的内部实现，
// 对外接口（ScreeningJudgment / ScreeningAnalytics）保持不变。

import { prisma } from './db';

export type AiLabel = 'tool_user' | 'task_solver' | 'app_creator';

export const LABEL_TEXT: Record<AiLabel, string> = {
  tool_user: 'AI 路人',
  task_solver: 'AI 搭子',
  app_creator: 'AI 合伙人',
};

export interface FollowupQuestion {
  id: 'task' | 'result' | 'action' | 'deepen';
  text: string;
  missing: 'task' | 'result' | 'action' | 'deepen';
}

export interface FeedbackCard {
  label: AiLabel;
  heard: string; // 我们看到了
  notHeard: string; // 还没看到
  strengthen: string; // 让标签更有说服力
  isComplete: boolean; // 本轮回答是否较完整
}

// 学生提交第一问后拿到的判定（含针对性追问）
export interface ScreeningJudgment {
  phase: 1;
  label: AiLabel; // 基于本次回答的“当前标签”
  confidence: 'low' | 'mid' | 'high';
  hasTools: boolean;
  hasTask: boolean;
  hasResult: boolean;
  hasAction: boolean;
  followup: FollowupQuestion;
  feedback: FeedbackCard;
  wordCount: number;
  interestSignal: number;
}

// ---------- 关键词与检测 ----------

const TOOLS = [
  '豆包', 'deepseek', 'deep seek', 'chatgpt', 'gpt', '文心', '通义', '智谱', 'kimi', 'coze',
  'claude', '元宝', 'gemini', '即梦', '即创', '秘塔', 'perplexity', 'midjourney', 'suno', '可灵',
  '剪映', 'cursor', 'copilot', 'notion', 'canva', 'runway', 'poe', '海螺', 'glm', 'qwen',
  '混元', '讯飞', '通义千问', 'wps', '夸克', '天工', '万兴', '稿子', 'pad', 'sora', 'veo',
];

const TASK_KW = [
  '学习', '考研', '英语', '考试', '作业', '论文', '报告', '方案', '策划', '运营', '写作', '写',
  '翻译', '代码', '编程', '开发', '设计', '营销', '课题', '复盘', '简历', '总结', '整理', '分析',
  '调研', '备课', '教学', '健身', '减肥', '理财', '副业', '工作', '项目', '任务',
];

const RESULT_KW = [
  '效率', '提升', '提高', '完成', '节省', '产出', '结果', '成果', '交付', '上线', '发布', '用户',
  '别人', '实际', '效果', '准确率', '速度', '倍', '份', '篇', '优化', '落地', '跑通', '沉淀',
  '复用', '帮忙', '解决', '做出', '做了', '生成了', '学会了',
];

const ACTION_KW = [
  '我搭建', '搭建', '我设计', '我配置', '我调试', '我优化', '我迭代', '我训练', '我提示', '我拆解',
  '我规划', '我验证', '我让', '我自己', '我写了', '我做了', '自动化', '流程', '系统', '部署', '集成',
  '复用的', '可复用', '交付', '开发',
];

function hit(text: string, kws: string[]): boolean {
  const t = text.toLowerCase();
  return kws.some((k) => t.includes(k.toLowerCase()));
}

const TOOL_USE_RE = /用\s*(了|过|ai|a\.i\.|工具|大模型)|使用\s*(了|过|ai|工具|大模型)|借助\s*ai|通过\s*ai|让\s*ai|用\s*ai|ai\s*工具/;

function detect(answer: string) {
  const t = answer.toLowerCase();
  const hasTools = hit(t, TOOLS) || TOOL_USE_RE.test(t);
  const hasTask = hit(t, TASK_KW);
  const hasResult = hit(t, RESULT_KW);
  const hasAction = hit(t, ACTION_KW);
  return { hasTools, hasTask, hasResult, hasAction };
}

// 是否已构成“合伙人”信号：亲自动手 + 任务，或明确做出可交付/可复用之物
function appSignal(d: { hasTask: boolean; hasResult: boolean; hasAction: boolean }, text: string): boolean {
  if (d.hasAction && d.hasTask) return true;
  return /搭建|系统|部署|上线|发布|可复用|自动化|流程|别人(用|能)|用户(用|使)|交付|开源|上线/.test(text.toLowerCase());
}

function computeLabel(d: { hasTask: boolean; hasResult: boolean; hasAction: boolean }, text: string): AiLabel {
  if (appSignal(d, text) && d.hasResult) return 'app_creator';
  if (d.hasTask && d.hasResult) return 'task_solver';
  return 'tool_user';
}

// ---------- 第一问判定 ----------

export function judgeAnswer(answer: string): ScreeningJudgment {
  const trimmed = (answer || '').trim();
  const d = detect(trimmed);
  const label = computeLabel(d, trimmed);
  const confidence: ScreeningJudgment['confidence'] =
    label === 'app_creator' ? 'high' : label === 'task_solver' ? 'mid' : 'low';

  return {
    phase: 1,
    label,
    confidence,
    hasTools: d.hasTools,
    hasTask: d.hasTask,
    hasResult: d.hasResult,
    hasAction: d.hasAction,
    followup: buildFollowup(d),
    feedback: buildFeedback({ label, ...d }),
    wordCount: trimmed.length,
    interestSignal: 4,
  };
}

// ---------- 动态追问：只追一个最缺失的信息 ----------

export function buildFollowup(d: {
  hasTools: boolean;
  hasTask: boolean;
  hasResult: boolean;
  hasAction: boolean;
}): FollowupQuestion {
  if (d.hasTools && !d.hasTask && !d.hasResult) {
    return {
      id: 'task',
      text: '你提到了几个 AI 工具。请选择其中一个：它具体帮你解决了什么问题？',
      missing: 'task',
    };
  }
  if (d.hasTask && !d.hasResult) {
    return {
      id: 'result',
      text: '这个项目最后产生了什么成果？有人实际使用过吗？',
      missing: 'result',
    };
  }
  if (d.hasTask && d.hasResult && !d.hasAction) {
    return {
      id: 'action',
      text: '这里面最能体现你 AI 能力的动作是什么？',
      missing: 'action',
    };
  }
  return {
    id: 'deepen',
    text: '如果把这个项目交给一位同事，他能不能照着你的方法复现？你最想强调哪一步？',
    missing: 'deepen',
  };
}

// ---------- 反馈卡 ----------

export function buildFeedback(d: {
  label: AiLabel;
  hasTools: boolean;
  hasTask: boolean;
  hasResult: boolean;
  hasAction: boolean;
}): FeedbackCard {
  const heardParts: string[] = [];
  if (d.hasTools) heardParts.push('你和 AI 打过照面，用过它的工具');
  if (d.hasTask) heardParts.push('你们一起办过具体的事');
  if (d.hasResult) heardParts.push('办完还有了成果');
  if (d.hasAction) heardParts.push('而且里面有你的关键动作');
  const heard = heardParts.length ? heardParts.join('；') : '你和 AI 还只是打了个照面';

  const missParts: string[] = [];
  if (!d.hasTask) missParts.push('你们一起做过什么事');
  if (!d.hasResult) missParts.push('做成了什么结果');
  if (!d.hasAction && d.label !== 'app_creator') missParts.push('你在其中亲自做了什么');
  const notHeard = missParts.length ? missParts.join('，') : '';

  const strengthen =
    d.label === 'app_creator'
      ? '把你们共创的方法沉淀成一套可复用的东西，让更多人也能搭上这段关系。'
      : d.label === 'task_solver'
      ? '再多说一点你们来来回回的细节——从第一次开口，到你们怎么一起把事办成。'
      : '挑一件你们一起做过的小事，说说你让它干了什么、它给了你什么。';

  return {
    label: d.label,
    heard,
    notHeard,
    strengthen,
    isComplete: d.hasTask && d.hasResult && d.hasAction,
  };
}

// ---------- 第二问提交后：合并两轮证据，给出更稳的“当前标签” ----------

export function refineJudgment(first: ScreeningJudgment, followupAnswer: string): ScreeningJudgment {
  const f = detect(followupAnswer);
  const hasTools = first.hasTools || f.hasTools;
  const hasTask = first.hasTask || f.hasTask;
  const hasResult = first.hasResult || f.hasResult;
  const hasAction = first.hasAction || f.hasAction;
  const mergedText = first.feedback.heard + ' ' + followupAnswer;
  const label = computeLabel({ hasTask, hasResult, hasAction }, mergedText);

  return {
    ...first,
    label,
    confidence: label === 'tool_user' ? 'low' : 'high',
    hasTools,
    hasTask,
    hasResult,
    hasAction,
    feedback: buildFeedback({ label, hasTools, hasTask, hasResult, hasAction }),
    wordCount: first.wordCount + (followupAnswer || '').trim().length,
  };
}

// ---------- 大屏揭晓用：全班标签分布 + 代表性样本 ----------

export interface ScreeningSample {
  anonymousId: string;
  answer: string;
  label: AiLabel;
  dims: { tools: boolean; task: boolean; result: boolean; action: boolean };
}

export interface ScreeningAnalytics {
  total: number; // 已接入
  submitted: number; // 已完成第一问
  labels: { tool_user: number; task_solver: number; app_creator: number };
  revealSamples: ScreeningSample[]; // 揭晓时展示的 3 条匿名样本
  rows: { anonymousId: string; answer: string; label: AiLabel }[]; // 逐人明细（教师端使用）
}

export async function getScreeningAnalytics(sessionId: string): Promise<ScreeningAnalytics> {
  const [progress, screenings] = await Promise.all([
    prisma.participant.findMany({ where: { sessionId }, select: { anonymousId: true } }),
    prisma.a0Screening.findMany({
      where: { sessionId },
      select: {
        anonymousId: true,
        answer: true,
        aiLabel: true,
        judgmentJson: true,
      },
    }),
  ]);

  const total = progress.length;
  const submitted = screenings.length;
  const labels: ScreeningAnalytics['labels'] = { tool_user: 0, task_solver: 0, app_creator: 0 };

  const all: ScreeningSample[] = screenings.map((r) => {
    const j = (r.judgmentJson as Record<string, unknown> | null) ?? {};
    const label = (r.aiLabel as AiLabel) || 'tool_user';
    labels[label] += 1;
    return {
      anonymousId: r.anonymousId,
      answer: r.answer,
      label,
      dims: {
        tools: Boolean((j as any).hasTools ?? false),
        task: Boolean((j as any).hasTask ?? false),
        result: Boolean((j as any).hasResult ?? false),
        action: Boolean((j as any).hasAction ?? false),
      },
    };
  });

  return {
    total,
    submitted,
    labels,
    revealSamples: pickReveal(all),
    rows: all.map((s) => ({ anonymousId: s.anonymousId, answer: s.answer, label: s.label })),
  };
}

// 选 3 条代表性样本：优先覆盖不同标签；太短（<8 字）的跳过
function pickReveal(all: ScreeningSample[]): ScreeningSample[] {
  const usable = all.filter((s) => s.answer.trim().length >= 8);
  const pool = usable.length ? usable : all;
  const byLabel: Record<AiLabel, ScreeningSample[]> = { tool_user: [], task_solver: [], app_creator: [] };
  for (const s of pool) byLabel[s.label].push(s);

  const picked: ScreeningSample[] = [];
  const order: AiLabel[] = ['tool_user', 'task_solver', 'app_creator'];
  for (const lab of order) {
    const cand = byLabel[lab].find((s) => !picked.includes(s));
    if (cand) picked.push(cand);
  }
  // 不足 3 条则用其余样本补齐
  for (const s of pool) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0, 3);
}
