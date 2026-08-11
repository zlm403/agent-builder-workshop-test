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

export async function saveA0Questions(anonymousId: string, answers: A0Answers) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');
  if (session.currentModuleId !== 'A0N_QUESTIONS') throw new Error('MODULE_NOT_ACTIVE');

  await prisma.a0New.upsert({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
    update: { answers: answers as object },
    create: {
      sessionId: p.sessionId,
      anonymousId,
      participantId: p.id,
      answers: answers as object,
    },
  });
  await markProgress(p.sessionId, anonymousId, 'A0N_QUESTIONS', { answers });
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
