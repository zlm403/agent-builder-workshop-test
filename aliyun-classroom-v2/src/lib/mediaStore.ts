// =========================================================
// 课堂内容框架（内容块）· 教师端管理，无需改代码
// 类型：text（文字）| image（图片）| video（视频）| link（链接）
// 按 slot 插槽归类排序
// =========================================================
import { prisma } from '@/lib/db';

export interface MediaItemInput {
  title: string;
  kind?: string; // text | image | video | link | embed
  url?: string | null;
  content?: string | null;
  slot?: string;
  sort?: number;
  align?: string; // left | center | right
  hidden?: boolean;
}

export async function listMedia(slot?: string, includeHidden = false) {
  return prisma.mediaItem.findMany({
    where: {
      ...(slot ? { slot } : {}),
      ...(includeHidden ? {} : { hidden: false }),
    },
    orderBy: [{ slot: 'asc' }, { sort: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createMedia(input: MediaItemInput) {
  return prisma.mediaItem.create({
    data: {
      title: input.title,
      kind: input.kind ?? 'text',
      url: input.url ?? null,
      content: input.content ?? null,
      slot: input.slot ?? 'custom',
      sort: input.sort ?? 0,
      align: input.align ?? 'center',
      hidden: input.hidden ?? false,
    },
  });
}

export async function deleteMedia(id: string) {
  await prisma.mediaItem.delete({ where: { id } });
  return { ok: true };
}

// 按插槽批量删除（用于内容页「清空本页」：删除该页所有内容块）
export async function deleteMediaBySlot(slot: string) {
  const { count } = await prisma.mediaItem.deleteMany({ where: { slot } });
  return { ok: true, count };
}

export async function updateMedia(
  id: string,
  patch: Partial<{ title: string; kind: string; url: string | null; content: string | null; slot: string; sort: number; align: string; hidden: boolean }>,
) {
  return prisma.mediaItem.update({ where: { id }, data: patch });
}
