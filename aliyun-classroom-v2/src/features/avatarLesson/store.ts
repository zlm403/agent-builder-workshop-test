// =========================================================
// 数字分身课 · 数据存取层（DB 读写 + 大屏统计）
// =========================================================
import { prisma } from '@/lib/db';
import { A0N_FIRST_MODULE } from './config';
import type { A0Question, A1Step } from './config';

/** 同步 ModuleProgress，让学生端 moduleStatus 显示 submitted，刷新后可恢复 */
export async function markProgress(sessionId: string, anonymousId: string, moduleId: string, data: unknown) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) return;
  await prisma.moduleProgress.upsert({
    where: { participantId_moduleId: { participantId: p.id, moduleId } },
    create: {
      participantId: p.id,
      sessionId,
      moduleId,
      status: 'submitted',
      submittedAt: new Date(),
      data: data as object,
    },
    update: { status: 'submitted', submittedAt: new Date(), data: data as object },
  });
}

// ---------- A0 新版 ----------

export interface A0Answers {
  q1?: string;
  q2?: string;
  q3?: string;
}

/**
 * 系统判定：基于三问回答，从行为判断学生与 AI 的关系（工具 / 伙伴）。
 * 两分类：有“一起做成事”的行为信号（具体任务 + 成果 + 亲自动作 / 长期深入）→ 伙伴；否则 → 工具。
 * 规则可调，改这里的信号词即可。
 */
const PARTNER_ACTION_KW = [
  '搭建', '部署', '上线', '发布', '自动化', '流程', '系统', '迭代', '配置', '调试', '训练',
  '我让', '我设计', '复现', '可复用', '沉淀', '持续', '长期', '一直', '每天', '一起', '协作',
  '共创', '改进', '优化', '磨合', '配合',
];
const PARTNER_RESULT_KW = ['成果', '做完', '完成', '做出了', '跑通', '学会了', '效果', '用户', '别人用', '给别人', '真正解决'];

export function judgeRelationFromQuestions(answers: A0Answers): 'tool' | 'partner' {
  const text = [answers.q1, answers.q2, answers.q3].filter(Boolean).join(' ');
  if (!text.trim()) return 'tool';
  let score = 0;
  for (const k of PARTNER_ACTION_KW) if (text.includes(k)) score++;
  for (const k of PARTNER_RESULT_KW) if (text.includes(k)) score++;
  // 明确表达想更深入 / 想改变关系
  if (/(想|希望).*(一起|长期|深入|真正|更懂|做成)/.test(text)) score++;
  return score >= 2 ? 'partner' : 'tool';
}

export async function saveA0Questions(anonymousId: string, answers: A0Answers) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');
  if (session.currentModuleId !== 'A0N_QUESTIONS') throw new Error('MODULE_NOT_ACTIVE');

  const relation = judgeRelationFromQuestions(answers);
  await prisma.a0New.upsert({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
    update: { answers: answers as object, relation },
    create: {
      sessionId: p.sessionId,
      anonymousId,
      participantId: p.id,
      answers: answers as object,
      relation,
    },
  });
  await markProgress(p.sessionId, anonymousId, 'A0N_QUESTIONS', { answers, relation });
  return { ok: true };
}

export async function saveA0Vote(anonymousId: string, relation: 'tool' | 'partner') {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');
  if (session.currentModuleId !== 'A0N_VOTE') throw new Error('MODULE_NOT_ACTIVE');
  if (relation !== 'tool' && relation !== 'partner') throw new Error('BAD_RELATION');

  await prisma.a0New.upsert({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
    update: { relation },
    create: {
      sessionId: p.sessionId,
      anonymousId,
      participantId: p.id,
      relation,
      answers: {},
    },
  });
  await markProgress(p.sessionId, anonymousId, 'A0N_VOTE', { relation });
  return { ok: true };
}

export interface A0Analytics {
  total: number;
  answered: number;
  voted: number;
  tool: number;
  partner: number;
  answerCountByQuestion: number[]; // 每问作答人数
}

// 滑杆：6 步的人机比例（0=全人, 100=全AI），key 对应 A0_SLIDER_STEPS
export type A0Sliders = Record<string, number>;

export async function saveA0Sliders(anonymousId: string, sliders: A0Sliders) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');
  if (session.currentModuleId !== 'A0N_REVEAL') throw new Error('MODULE_NOT_ACTIVE');

  const exists = await prisma.a0New.findUnique({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
  });
  if (exists) {
    await prisma.a0New.update({
      where: { id: exists.id },
      data: { sliders: sliders as object },
    });
  } else {
    await prisma.a0New.create({
      data: {
        sessionId: p.sessionId,
        anonymousId,
        participantId: p.id,
        answers: {},
        sliders: sliders as object,
      },
    });
  }
  await markProgress(p.sessionId, anonymousId, 'A0N_REVEAL', { sliders });
  return { ok: true };
}

export interface A0SlidersAnalytics {
  total: number; // 全班人数
  submitted: number; // 已提交滑杆人数
  // 每步分布：{ label, buckets: [偏人, 中间, 偏AI] 人数 }（<40 偏人, 40-60 中间, >60 偏AI）
  byStep: { label: string; buckets: [number, number, number] }[];
  avgHuman: number; // 全体平均"人"占比 0-100
  avgAi: number; // 全体平均"AI"占比 0-100
}

export async function getA0SlidersAnalytics(sessionId: string): Promise<A0SlidersAnalytics> {
  const [total, rows] = await Promise.all([
    prisma.participant.count({ where: { sessionId } }),
    prisma.a0New.findMany({ where: { sessionId } }),
  ]);
  const labels = ['目标定义', '方案设计', '能力调动', '执行创造', '结果验证', '迭代优化'];
  const byStep = labels.map(() => [0, 0, 0] as [number, number, number]);
  let sumHuman = 0;
  let sumCount = 0;
  let submitted = 0;
  for (const r of rows) {
    const s = r.sliders as A0Sliders | null;
    if (!s) continue;
    submitted++;
    const keys = ['target', 'plan', 'skill', 'make', 'check', 'iterate'];
    keys.forEach((k, i) => {
      const v = Number(s[k]);
      if (Number.isFinite(v) && byStep[i]) {
        const human = 100 - v;
        sumHuman += human;
        sumCount++;
        if (v < 40) byStep[i][0]++;
        else if (v <= 60) byStep[i][1]++;
        else byStep[i][2]++;
      }
    });
  }
  return {
    total,
    submitted,
    byStep: byStep.map((b, i) => ({ label: labels[i], buckets: b })),
    avgHuman: sumCount > 0 ? Math.round(sumHuman / sumCount) : 0,
    avgAi: sumCount > 0 ? 100 - Math.round(sumHuman / sumCount) : 0,
  };
}

export async function getA0Analytics(sessionId: string): Promise<A0Analytics> {
  const [total, rows] = await Promise.all([
    prisma.participant.count({ where: { sessionId } }),
    prisma.a0New.findMany({ where: { sessionId } }),
  ]);
  let tool = 0;
  let partner = 0;
  let answered = 0;
  const answerCountByQuestion = [0, 0, 0];
  for (const r of rows) {
    if (r.relation === 'tool') tool++;
    if (r.relation === 'partner') partner++;
    const a = (r.answers as A0Answers | null) ?? {};
    if (a.q1 || a.q2 || a.q3) answered++;
    if (a.q1) answerCountByQuestion[0]++;
    if (a.q2) answerCountByQuestion[1]++;
    if (a.q3) answerCountByQuestion[2]++;
  }
  return { total, answered, voted: tool + partner, tool, partner, answerCountByQuestion };
}

// ---------- A1 数字分身 ----------

export interface A1ChatTurn {
  role: 'ai' | 'user';
  content: string;
}

export async function getA1Record(sessionId: string, anonymousId: string) {
  return prisma.a1Avatar.findUnique({ where: { sessionId_anonymousId: { sessionId, anonymousId } } });
}

export async function ensureA1Record(sessionId: string, anonymousId: string) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  let rec = await prisma.a1Avatar.findUnique({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
  });
  if (!rec) {
    rec = await prisma.a1Avatar.create({
      data: { sessionId, anonymousId, participantId: p.id, chatLog: [], drafts: [] },
    });
  }
  return rec;
}

const SESSION_LOCK: Record<string, string | null> = {};

/** 轮询锁：同一课堂同一 sessionId，串行保证聊天顺序不交错 */
export async function withA1Lock(
  sessionId: string,
  fn: () => Promise<any>,
): Promise<any> {
  const key = `a1:${sessionId}`;
  while (SESSION_LOCK[key]) {
    await new Promise((r) => setTimeout(r, 120));
  }
  SESSION_LOCK[key] = 'busy';
  try {
    return await fn();
  } finally {
    SESSION_LOCK[key] = null;
  }
}

export async function updateA1(
  sessionId: string,
  anonymousId: string,
  patch: Partial<{
    step: number;
    dream: string;
    path: string;
    chatLog: A1ChatTurn[];
    profileJson: unknown;
    skillText: string;
    task: string;
    planChoice: string;
    drafts: unknown;
    feedback: string;
    finalText: string;
    submittedAt: Date | null;
  }>,
) {
  const rec = await ensureA1Record(sessionId, anonymousId);
  return prisma.a1Avatar.update({ where: { id: rec.id }, data: patch as object });
}

export interface A1WallRow {
  anonymousId: string;
  nickname: string | null;
  step: number;
  summary: string; // 一句话：谁 + 梦想/主题 摘要
}

export interface A1Analytics {
  total: number;
  started: number;
  byStep: number[]; // 1..6 各达到的人数
  finished: number;
  cols: string[]; // 朋友圈表达主题汇总（用于拆墙）
  rows: A1WallRow[];
}

export async function getA1Analytics(sessionId: string): Promise<A1Analytics> {
  const [parts, recs] = await Promise.all([
    prisma.participant.findMany({ where: { sessionId }, select: { anonymousId: true, nickname: true, wechatName: true } }),
    prisma.a1Avatar.findMany({ where: { sessionId } }),
  ]);
  const byStep = [0, 0, 0, 0, 0, 0];
  for (const r of recs) {
    const s = Math.min(6, Math.max(1, r.step));
    for (let i = s; i <= 6; i++) byStep[i - 1]++; // step>=i 视为已达第 i 步
  }
  const byName = new Map(parts.map((p) => [p.anonymousId, p.wechatName ?? p.nickname ?? null]));
  const rows: A1WallRow[] = recs.map((r) => ({
    anonymousId: r.anonymousId,
    nickname: byName.get(r.anonymousId) ?? null,
    step: r.step,
    summary: r.task || r.dream || '',
  }));
  const finished = recs.filter((r) => r.step >= 6).length;
  const cols = recs
    .map((r) => (r.finalText ? r.finalText.slice(0, 120) : r.task || r.dream || ''))
    .filter(Boolean)
    .slice(0, 40);
  return {
    total: parts.length,
    started: recs.length,
    byStep,
    finished,
    cols,
    rows,
  };
}

export { A0N_FIRST_MODULE };
export type { A0Question, A1Step };
