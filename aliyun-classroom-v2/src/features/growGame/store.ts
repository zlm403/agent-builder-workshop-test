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
    trait: string;
    traitWhy: string;
    lifeDesign: object;
    lifeNotes: object;
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

/** 保存生命设计（含名字/特质/设计卡） */
export async function saveLifeDesign(
  sessionId: string,
  anonymousId: string,
  data: { objectName: string; trait: string; traitWhy: string; lifeDesign: object },
) {
  const rec = await ensureP3Record(sessionId, anonymousId);
  return prisma.p3GrowGame.update({
    where: { id: rec.id },
    data: { objectName: data.objectName, trait: data.trait, traitWhy: data.traitWhy, lifeDesign: data.lifeDesign as object },
  });
}

/** 标记已投入共生缸 */
export async function markP3Submitted(sessionId: string, anonymousId: string, finalWork: string) {
  const rec = await ensureP3Record(sessionId, anonymousId);
  await updateP3(sessionId, anonymousId, {
    finalWork,
    step: 10,
    submittedAt: new Date(),
  });
  await markP3Progress(sessionId, anonymousId, 'P3_GAME', { finalWork });
  return rec;
}

/** 大屏共生缸：取全班已投入的生命 */
export async function getTankLives(sessionId: string) {
  const recs = await prisma.p3GrowGame.findMany({
    where: { sessionId, submittedAt: { not: null } },
    select: { anonymousId: true, objectName: true, trait: true, lifeDesign: true },
  });
  return recs
    .filter((r) => r.lifeDesign)
    .map((r) => ({
      id: r.anonymousId,
      name: r.objectName || '无名生命',
      trait: r.trait || '',
      design: r.lifeDesign as object,
    }));
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
  const byStep = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const r of recs) {
    const s = Math.min(10, Math.max(1, r.step));
    for (let i = s; i <= 10; i++) byStep[i - 1]++;
  }
  const byName = new Map(parts.map((p) => [p.anonymousId, p.wechatName ?? p.nickname ?? null]));
  const rows: P3WallRow[] = recs.map((r) => ({
    anonymousId: r.anonymousId,
    nickname: byName.get(r.anonymousId) ?? null,
    step: r.step,
    summary: r.objectName || r.trait || '',
  }));
  const finished = recs.filter((r) => r.step >= 10).length;
  const cols = recs
    .map((r) => (r.finalWork ? r.finalWork.slice(0, 160) : r.objectName ? `生命：${r.objectName} · ${r.trait || ''}` : ''))
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