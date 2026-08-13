// =========================================================
// 环节页面序列（PPT 式）· 每个环节由一串"页"组成
// 页类型：
//   builtin — 内置功能页，对应某个 subState（三问/判定/揭晓/滑块/共生缸…），可隐藏可排序不可删
//   content — 内容页（文字/图片/视频/链接/网页），内容块存 MediaItem(slot=page:{pageId})
// 教师端按此序列渲染页卡片列表，大屏/学生端按 subState 逐页展示。
// =========================================================
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const PAGE_GROUPS = ['A0', 'A1', 'P2', 'P3'] as const;
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
  { group: 'A0', moduleId: 'A0N_VOTE', refKey: null, label: '系统判定' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:1', label: '揭晓结果' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:2', label: '三种形态' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:4', label: '六步滑块' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'reveal:3', label: '工具/伙伴两图' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'a0:mirror', label: '我们在哪儿' },
  { group: 'A0', moduleId: 'A0N_REVEAL', refKey: 'a0:closing', label: '收束·已经来了' },

  // ---- A1 数字分身 ----
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:hook', label: '钩子开场' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c1', label: '发现问题' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c2', label: '发布任务' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c3', label: '选择真实任务' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c4', label: 'AI 采访' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c5', label: '补充真实样本' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c6', label: '生成分身档案' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c7', label: '校准档案' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c8', label: '第一次写朋友圈' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c9', label: '判断像不像' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c10', label: '调整' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c11', label: '最终验收' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c12', label: '保存分身' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c13', label: '梦想' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c14', label: '一个到一群' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c15', label: '分析' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c16', label: '现实与紧迫' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:c17', label: '结论' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:wall', label: '作品墙' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:cog', label: '认知对比图' },
  { group: 'A1', moduleId: 'A1_AVATAR', refKey: 'avatar:video', label: '视频·普通人的例子' },

  // ---- P2 快速入门网站 ----
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:hook', label: '钩子开场' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s1', label: '发布任务' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s2', label: '明确目标' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s3', label: '获取领域地图' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s4', label: '判断与收缩' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s5', label: '生成可用内容' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s6', label: '生成网页' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s7', label: '第一轮自检' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s8', label: '同伴测试' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s9', label: '根据反馈修改' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s10', label: '能力迁移' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s11', label: '提交与成果' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:s12', label: '升华' },
  { group: 'P2', moduleId: 'P2_SITE', refKey: 'p2:wall', label: '作品墙' },

  // ---- P3 养成游戏 ----
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:hook', label: '钩子开场' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s1', label: '空世界' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s2', label: '核心特质' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s3', label: '设计规则' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s4', label: 'AI翻译生成' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s5', label: '投入共生缸' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s6', label: '观察' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s7', label: '修改' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s8', label: '二次运行' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s9', label: '创造过程卡' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:s10', label: '认知收束' },
  { group: 'P3', moduleId: 'P3_GAME', refKey: 'p3:wall', label: '共生缸' },
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
  if (moduleId === 'P2_SITE') return 'P2';
  if (moduleId === 'P3_GAME') return 'P3';
  return null;
}

// seed：确保某组的默认内置页已存在（幂等，只补缺，不覆盖教师已有调整）
export async function ensurePages(group: PageGroup) {
  const seeds = BUILTIN_SEEDS.filter((s) => s.group === group);
  const existing = await prisma.lessonPage.findMany({ where: { group }, orderBy: { seq: 'asc' } });
  // 内置页唯一键 = moduleId:refKey（refKey 为 null 用 ''，A0 的"三问/判定"靠 moduleId 区分）
  const existingKeys = new Set(
    existing.filter((e) => e.kind === 'builtin').map((e) => `${e.moduleId}:${e.refKey ?? ''}`),
  );
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
  if (group === 'P2') return 'P2_SITE';
  return 'P3_GAME';
}// 更新页：改标题 / 隐藏 / 排序（seq 重排）/ 文字覆盖 overrides
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
