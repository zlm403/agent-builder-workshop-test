// =========================================================
// 方案三 · 养成游戏 · 数据存取层（DB 读写 + 大屏统计）
// =========================================================
import { prisma } from '@/lib/db';

/** 同步 ModuleProgress，让学生端 moduleStatus 显示 submitted，刷新后可恢复 */
export async function markP3Progress(sessionId: string, anonymousId: string, moduleId: string, data: unknown) {
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

export interface P3ChatTurn {
  role: 'ai' | 'user';
  content: string;
}

export async function getP3Record(sessionId: string, anonymousId: string) {
  return prisma.p3GrowGame.findUnique({ where: { sessionId_anonymousId: { sessionId, anonymousId } } });
}

export async function ensureP3Record(sessionId: string, anonymousId: string) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  let rec = await prisma.p3GrowGame.findUnique({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
  });
  if (!rec) {
    rec = await prisma.p3GrowGame.create({
      data: { sessionId, anonymousId, participantId: p.id, chatLog: [] },
    });
  }
  return rec;
}

export async function updateP3(
  sessionId: string,
  anonymousId: string,
  patch: Partial<{
    step: number;
    objectName: string;
    growthDef: string;
    coreRules: string;
    events: string;
    endings: string;
    chatLog: P3ChatTurn[];
    gameCode: string;
    testNote: string;
    finalWork: string;
    submittedAt: Date | null;
  }>,
) {
  const rec = await ensureP3Record(sessionId, anonymousId);
  return prisma.p3GrowGame.update({ where: { id: rec.id }, data: patch as object });
}

export interface P3WallRow {
  anonymousId: string;
  nickname: string | null;
  step: number;
  summary: string;
}

export interface P3Analytics {
  total: number;
  started: number;
  byStep: number[]; // 1..6 各达到的人数
  finished: number;
  cols: string[]; // 作品摘要（用于大屏作品墙）
  rows: P3WallRow[];
}

export async function getP3Analytics(sessionId: string): Promise<P3Analytics> {
  const [parts, recs] = await Promise.all([
    prisma.participant.findMany({ where: { sessionId }, select: { anonymousId: true, nickname: true, wechatName: true } }),
    prisma.p3GrowGame.findMany({ where: { sessionId } }),
  ]);
  const byStep = [0, 0, 0, 0, 0, 0];
  for (const r of recs) {
    const s = Math.min(6, Math.max(1, r.step));
    for (let i = s; i <= 6; i++) byStep[i - 1]++;
  }
  const byName = new Map(parts.map((p) => [p.anonymousId, p.wechatName ?? p.nickname ?? null]));
  const rows: P3WallRow[] = recs.map((r) => ({
    anonymousId: r.anonymousId,
    nickname: byName.get(r.anonymousId) ?? null,
    step: r.step,
    summary: r.objectName || r.growthDef || '',
  }));
  const finished = recs.filter((r) => r.step >= 6).length;
  const cols = recs
    .map((r) => (r.finalWork ? r.finalWork.slice(0, 160) : r.objectName ? `养成对象：${r.objectName} · ${r.growthDef || ''}` : ''))
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