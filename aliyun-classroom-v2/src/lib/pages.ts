// =========================================================
// 环节页面序列（PPT 式）· 每个环节由一串"页"组成
// 页类型：
//   builtin — 内置功能页，对应某个 subState（三问/判定/揭晓/滑块/共生缸…），可隐藏可排序不可删
//   content — 内容页（文字/图片/视频/链接/网页），内容块存 MediaItem(slot=page:{pageId})
// 教师端按此序列渲染页卡片列表，大屏/学生端按 subState 逐页展示。
// =========================================================
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const PAGE_GROUPS = ['A0', 'A1', 'A2'] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

export interface LessonPageDef {
  id: string;
  group: string;
  moduleId: string;
  seq: number;
  kind: 'builtin' | 'content';
  refKey: string | null;
  title: string | null;
  hidden: boolean;
}

// 内置页默认序列（首次运行时 seed 进 DB）。kind=builtin。
// subState 为 null 的页表示"该模块的默认态"（如 A0 三问 = A0N_QUESTIONS 无 subState）。
interface BuiltinSeed {
  group: PageGroup;
  moduleId: string;
  refKey: string | null; // subState；null = 模块默认态
  label: string; // 教师端显示名
}

const BUILTIN_SEEDS: BuiltinSeed[] = [
  // ---- A0 开场（跨 A0N_QUESTIONS / A0N_VOTE / A0N_REVEAL 三个模块）----
  { group: 'A0', moduleId: 'A0N_QUESTIONS', refKey: 'a0:intro1', label: '开场·手指图' },
  { group: 'A0', moduleId: 'A0N_QUESTIONS', refKey: 'a0:intro2', label: '开场·发展图' },
  { group: 'A0', moduleId: 'A0N_QUESTIONS', refKey: null, label: '三问' },
  // 系统判定页已与揭晓结果页合并（2026-08-14），不再作为独立页
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:1', label: '揭晓结果' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:2', label: '三种形态' },
  // 六步滑块页已去掉（2026-08-14）：滑块移到手机端，挂在"三种形态"时推给学生滑，不提交
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:3', label: '工具/伙伴两图' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'a0:mirror', label: '我们在哪儿' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'a0:closing', label: '收束·已经来了' },

  // ---- A1 数字分身（2026-08-14 重构：13 屏新结构）----
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:hook', label: '钩子开场' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c1', label: '发布任务' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c2', label: 'AI沟通准则①' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c3', label: '目标辨析' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c4', label: 'AI沟通准则②' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c5', label: 'AI采访我' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c6', label: '让分身开始工作' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:wall', label: '作品墙' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c7', label: '梦想①打开世界' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c8', label: '梦想②一个人与一支队伍' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c9', label: '现实：一人公司' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c10', label: '现实信号' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c11', label: 'A1收束 → A2问题' },

  // ---- A2 快速入门网站 ----
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:hook', label: '钩子开场' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s1', label: '发布任务' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s2', label: '产生疑问' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s3', label: '找到方法' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s4', label: '会前准备' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s5', label: 'AI团队开会→自动执行' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s6', label: '检验、迭代，最后提交' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:wall', label: '作品墙' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s7', label: '认知思考' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s8', label: '梦想互动/梦想墙' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s9', label: '未来展开' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s10', label: '最后升华' },
];

// 内置页显示名（教师端页卡片用）
export function builtinLabel(group: PageGroup, refKey: string | null): string {
  if (refKey === null) {
    return group === 'A0' ? '三问' : '默认';
  }
  const hit = BUILTIN_SEEDS.find((s) => s.group === group && s.refKey === refKey);
  return hit?.label ?? refKey;
}

// 模块 → 组 映射（用于教师端由当前模块反查组）
export function groupOfModule(moduleId: string | null | undefined): PageGroup | null {
  if (!moduleId) return null;
  if (moduleId.startsWith('A0N_')) return 'A0';
  if (moduleId === 'A1_AVATAR') return 'A1';
  if (moduleId === 'A2_SITE') return 'A2';
  return null;
}

// seed：确保某组的默认内置页已存在（幂等，只补缺，不覆盖教师已有调整）
export async function ensurePages(group: PageGroup) {
  const seeds = BUILTIN_SEEDS.filter((s) => s.group === group);
  const existing = await prisma.lessonPage.findMany({ where: { group }, orderBy: { seq: 'asc' } });
  // 内置页唯一键 = moduleId:refKey（refKey 为 null 用 ''，A0 的"三问"靠 moduleId 区分）
  const existingKeys = new Set(
    existing.filter((e) => e.kind === 'builtin').map((e) => `${e.moduleId}:${e.refKey ?? ''}`),
  );
  // 清理：种子里已不存在的内置页（如合并掉的老页）→ 删除，保持与种子一致
  const seedKeys = new Set(seeds.map((s) => `${s.moduleId}:${s.refKey ?? ''}`));
  for (const e of existing) {
    if (e.kind === 'builtin' && !seedKeys.has(`${e.moduleId}:${e.refKey ?? ''}`)) {
      await prisma.lessonPage.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
  // 重排：把所有内置页按种子顺序重写 seq（保证顺序始终与种子一致，不受历史 seq 残留影响）
  {
    const builtins = existing.filter((e) => e.kind === 'builtin');
    let bi = 0;
    for (const s of seeds) {
      const key = `${s.moduleId}:${s.refKey ?? ''}`;
      const page = builtins.find((e) => `${e.moduleId}:${e.refKey ?? ''}` === key);
      if (page && page.seq !== bi) {
        await prisma.lessonPage.update({ where: { id: page.id }, data: { seq: bi } }).catch(() => {});
      }
      bi++;
    }
  }
  const maxSeq = existing.reduce((m, e) => Math.max(m, e.seq), -1);

  let seq = maxSeq + 1;
  for (const s of seeds) {
    const key = `${s.moduleId}:${s.refKey ?? ''}`;
    if (existingKeys.has(key)) continue;
    await prisma.lessonPage.create({
      data: {
        group,
        moduleId: s.moduleId,
        seq: seq++,
        kind: 'builtin',
        refKey: s.refKey,
        title: null,
        hidden: false,
      },
    });
    existingKeys.add(key);
  }
}

// 读取某组完整页面序列（builtin + content，含内容页标题）
export async function listPages(group: PageGroup) {
  await ensurePages(group);
  return prisma.lessonPage.findMany({
    where: { group },
    orderBy: [{ seq: 'asc' }, { createdAt: 'asc' }],
  });
}

// 新建内容页（插在某页之后；afterId 为空则插到末尾）
export async function createContentPage(group: PageGroup, afterId: string | null, title: string) {
  const pages = await prisma.lessonPage.findMany({ where: { group }, orderBy: { seq: 'asc' } });
  const after = afterId ? pages.find((p) => p.id === afterId) : null;
  let seq: number;
  if (!after) {
    seq = pages.length ? Math.max(...pages.map((p) => p.seq)) + 1 : 0;
  } else {
    seq = after.seq + 1;
    // 后移该页之后的所有页
    await prisma.$transaction(
      pages
        .filter((p) => p.seq > after.seq)
        .map((p) => prisma.lessonPage.update({ where: { id: p.id }, data: { seq: p.seq + 1 } })),
    );
  }
  const page = await prisma.lessonPage.create({
    data: {
      group,
      moduleId: after?.moduleId ?? defaultModuleOf(group),
      seq,
      kind: 'content',
      refKey: null,
      title: title || '新页面',
      hidden: false,
    },
  });
  return page;
}

function defaultModuleOf(group: PageGroup): string {
  if (group === 'A0') return 'A0N_QUESTIONS';
  if (group === 'A1') return 'A1_AVATAR';
  return 'A2_SITE';
}

// 更新页：改标题 / 隐藏 / 排序（seq 重排）/ 文字覆盖 overrides
export async function updatePage(
  id: string,
  patch: Partial<{ title: string; hidden: boolean; seq: number; overrides: Record<string, string> | null }>,
) {
  return prisma.lessonPage.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
      ...(patch.seq !== undefined ? { seq: patch.seq } : {}),
      ...(patch.overrides !== undefined ? { overrides: patch.overrides === null ? Prisma.JsonNull : (patch.overrides as object) } : {}),
    },
  });
}

// 重排：按 ids 顺序重写 seq（0..n-1）
export async function reorderPages(group: PageGroup, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, i) => prisma.lessonPage.update({ where: { id }, data: { seq: i } })),
  );
  return listPages(group);
}

// 删除：仅内容页可删（内置页受保护）。同时清掉其内容块（MediaItem slot=page:{id}）。
export async function deletePage(id: string) {
  const page = await prisma.lessonPage.findUnique({ where: { id } });
  if (!page) return { ok: false, reason: '页不存在' };
  if (page.kind === 'builtin') return { ok: false, reason: '内置功能页不可删除（可隐藏）' };
  await prisma.$transaction([
    prisma.mediaItem.deleteMany({ where: { slot: `page:${id}` } }),
    prisma.lessonPage.delete({ where: { id } }),
  ]);
  return { ok: true };
}

// 某内置页的文字覆盖（大屏按 subState 取；无覆盖返回 null）
export async function getBuiltinOverrides(group: PageGroup, refKey: string): Promise<Record<string, string> | null> {
  const page = await prisma.lessonPage.findFirst({
    where: { group, kind: 'builtin', refKey },
  });
  return (page?.overrides as Record<string, string> | null) ?? null;
}
