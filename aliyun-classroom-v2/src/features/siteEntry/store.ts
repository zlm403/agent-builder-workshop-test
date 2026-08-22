// =========================================================
// A2 快速入门网站 · 数据存取（Prisma）
// 团队配置 / 对话记录 / 网站代码 / 提交状态
// =========================================================
import { prisma } from '@/lib/db';

export interface A2TeamMember {
  id: string;
  label: string;
  icon: string;
  duty: string;
}

// 读取某学生的 A2 记录
export async function getA2Record(sessionId: string, anonymousId: string) {
  return prisma.a2SiteEntry.findUnique({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
  });
}

// 确保记录存在
export async function ensureA2Record(sessionId: string, anonymousId: string, participantId: string) {
  const rec = await getA2Record(sessionId, anonymousId);
  if (rec) return rec;
  return prisma.a2SiteEntry.create({
    data: { sessionId, anonymousId, participantId, step: 1 },
  });
}

// 保存团队（员工卡片）
export async function saveTeam(sessionId: string, anonymousId: string, team: A2TeamMember[]) {
  return prisma.a2SiteEntry.upsert({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
    create: { sessionId, anonymousId, participantId: '', team: team as object },
    update: { team: team as object },
  });
}

// 追加/更新对话记录
export async function appendChat(sessionId: string, anonymousId: string, chatLog: object[]) {
  return prisma.a2SiteEntry.upsert({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
    create: { sessionId, anonymousId, participantId: '', chatLog: chatLog as object },
    update: { chatLog: chatLog as object },
  });
}

// 保存网站代码
export async function saveSiteCode(sessionId: string, anonymousId: string, siteCode: string) {
  return prisma.a2SiteEntry.upsert({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
    create: { sessionId, anonymousId, participantId: '', siteCode },
    update: { siteCode },
  });
}

// 提交作品（作品名由学生提交时填写）
export async function submitA2(sessionId: string, anonymousId: string, title?: string) {
  return prisma.a2SiteEntry.upsert({
    where: { sessionId_anonymousId: { sessionId, anonymousId } },
    create: { sessionId, anonymousId, participantId: '', title: title?.trim() || null, submittedAt: new Date() },
    update: { title: title?.trim() || null, submittedAt: new Date() },
  });
}

// 大屏统计：全班提交情况（含每件的作品名/团队/HTML，供作品墙渲染）
export async function getA2Analytics(sessionId: string) {
  const [total, rows] = await Promise.all([
    prisma.a2SiteEntry.count({ where: { sessionId } }),
    prisma.a2SiteEntry.findMany({ where: { sessionId }, orderBy: { submittedAt: 'asc' } }),
  ]);
  const submittedRows = rows.filter((r) => r.submittedAt);
  const items = submittedRows
    .filter((r) => r.siteCode)
    .map((r, i) => ({
      order: i + 1,
      title: r.title || `作品 ${i + 1}`,
      siteCode: r.siteCode as string,
      team: (r.team as { id: string; label: string; icon: string; duty: string }[]) ?? [],
    }));
  return { total, submitted: submittedRows.length, items, cols: items.map((it) => it.siteCode) };
}
