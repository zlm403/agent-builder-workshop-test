// =========================================================
// 环节页面序列（PPT 式）· 每个环节由一串"页"组成
// 页类型：
//   builtin — 内置功能页，对应某个 subState（三问/判定/揭晓/滑块/共生缸…），可隐藏可排序不可删
//   content — 内容页（文字/图片/视频/链接/网页），内容块存 MediaItem(slot=page:{pageId})
// 教师端按此序列渲染页卡片列表，大屏/学生端按 subState 逐页展示。
// =========================================================
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const PAGE_GROUPS = ['A0', 'A1', 'A2', 'A3', 'CLOSING'] as const;
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

  // ---- A2 快速入门网站（仅"交互功能页"：会前准备/AI团队开会/检验提交/梦想墙 + 钩子/作品墙）
  //      纯展示环节（发布任务/产生疑问/找到方法/认知思考/未来展开/最后升华）见 CONTENT_SEEDS，做成内容页（铁律）
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:hook', label: '钩子开场' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s4', label: '会前准备' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s5', label: 'AI团队开会→自动执行' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s6', label: '检验、迭代，最后提交' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:wall', label: '作品墙' },
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s8', label: '梦想互动/梦想墙' },

  // ---- A3 我的世界（只留第一页"世界预告"加载大屏；课堂玩法全部走"发布 Tips"弹窗，无需页面序列） ----
  { group: 'A3', moduleId: 'A3_WORLD', refKey: 'world:hook', label: '世界预告' },

  // ---- 收官（每屏一个环节，教师端点环节页投屏；子控制条跟随当前环节显示在教师端）----
  { group: 'CLOSING', moduleId: 'CLOSING', refKey: 'closing:pain', label: '痛点墙' },
  { group: 'CLOSING', moduleId: 'CLOSING', refKey: 'closing:wings', label: '四翼展示' },
];

// =========================================================
// 内容页种子（铁律：A2 纯展示环节 = 只显示文字/图/视频的页，必须做成内容页）
// 纯展示：发布任务(s1)/产生疑问(s2)/找到方法(s3)/认知思考(s7)/未来展开(s9)/最后升华(s10)
// 交互环节（会前准备 s4 / AI团队开会 s5 / 检验提交 s6 / 梦想墙 s8）保持功能页。
// 内容页 = title + 内容块（MediaItem slot=page:{id}），教师可自由编辑+调位置。
// 种子页保留 refKey（= 原内置页 subState）作为身份标识，用于幂等 seed 与迁移；可隐藏不可删。
// =========================================================
export interface ContentSeedDef {
  group: PageGroup;
  moduleId: string;
  refKey: string; // 原内置页 subState（如 a2:s1），内容页身份标识
  title: string; // 内容页大标题
  blocks: { kind: 'text' | 'image' | 'video' | 'link' | 'embed'; title?: string; content?: string; url?: string }[];
}

export const CONTENT_SEEDS: ContentSeedDef[] = [
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s1', title: '发布任务', blocks: [
    { kind: 'text', title: '任务标题', content: '做一个帮助小白进入陌生领域的手机网站' },
    { kind: 'text', title: '任务说明', content: '帮一个完全不懂的人，快速进入一个陌生领域。' },
  ]},
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s2', title: '产生疑问', blocks: [
    { kind: 'text', title: '图片位', content: '（图片位：深夜，一个年轻人面对电脑和大量资料，茫然不知所措）' },
  ]},
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s3', title: '找到方法', blocks: [
    { kind: 'text', title: '点题', content: '那就找会做的人。' },
    { kind: 'text', title: '说明', content: '不会做，就找会做的人。' },
  ]},
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s7', title: '认知思考', blocks: [
    { kind: 'text', title: '图片位', content: '（图片位：放一张认知总结图）' },
  ]},
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s9', title: '未来展开', blocks: [
    { kind: 'text', title: '视频位', content: '（视频位：播放一段视频，让情绪继续向上）' },
  ]},
  { group: 'A2', moduleId: 'A2_SITE', refKey: 'a2:s10', title: '最后升华', blocks: [
    { kind: 'text', title: '升华', content: '最重要的是什么？' },
  ]},
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
  if (moduleId === 'A3_WORLD') return 'A3';
  if (moduleId === 'CLOSING') return 'CLOSING';
  return null;
}

// seed：确保某组的默认内置页 + 内容页种子已存在（幂等，只补缺，不覆盖教师已有调整）
export async function ensurePages(group: PageGroup) {
  const seeds = BUILTIN_SEEDS.filter((s) => s.group === group);
  const contentSeeds = CONTENT_SEEDS.filter((s) => s.group === group);
  const existing = await prisma.lessonPage.findMany({ where: { group }, orderBy: { seq: 'asc' } });

  // 1) 内容页种子（纯展示环节）：旧内置页迁移为内容页 / 缺失则新建，并 seed 默认内容块
  for (const cs of contentSeeds) {
    let page = existing.find((e) => e.refKey === cs.refKey);
    if (!page) {
      page = await prisma.lessonPage.create({
        data: { group, moduleId: cs.moduleId, seq: 0, kind: 'content', refKey: cs.refKey, title: cs.title, hidden: false },
      });
    } else if (page.kind !== 'content') {
      // 旧内置纯展示页 → 内容页（保留 refKey 身份与位置，标题给默认）
      await prisma.lessonPage.update({ where: { id: page.id }, data: { kind: 'content', title: cs.title } });
    }
    // seed 默认内容块（仅当该页还没有任何内容块时，不覆盖教师已有编辑）
    await seedDefaultBlocksIfEmpty(page.id, cs);
  }
  // 迁移后重新拉取（上面的 kind 转换已入库，in-memory existing 已过期）
  const afterMigration = await prisma.lessonPage.findMany({ where: { group }, orderBy: { seq: 'asc' } });

  // 2) 内置页（功能页）seed：清理 + 补缺
  const existingKeys = new Set(
    afterMigration.filter((e) => e.kind === 'builtin').map((e) => `${e.moduleId}:${e.refKey ?? ''}`),
  );
  const seedKeys = new Set(seeds.map((s) => `${s.moduleId}:${s.refKey ?? ''}`));
  for (const e of afterMigration) {
    if (e.kind === 'builtin' && !seedKeys.has(`${e.moduleId}:${e.refKey ?? ''}`)) {
      await prisma.lessonPage.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
  // 补缺内置页
  const maxSeq = afterMigration.reduce((m, e) => Math.max(m, e.seq), -1);
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

  // 3) 重排：种子页（内置 + 内容页）按全序对齐 seq（只动种子页，不碰教师后加的内容页）
  const order = fullOrder(group);
  const all = await prisma.lessonPage.findMany({ where: { group } });
  for (let i = 0; i < order.length; i++) {
    const o = order[i];
    const page = all.find((e) => e.kind === o.kind && e.refKey === o.refKey);
    if (page && page.seq !== i) {
      await prisma.lessonPage.update({ where: { id: page.id }, data: { seq: i } }).catch(() => {});
    }
  }
}

// 每组的全序（内置功能页 + 内容页种子交错），重排按此对齐
function fullOrder(group: PageGroup): { refKey: string | null; kind: 'builtin' | 'content' }[] {
  const builtins = BUILTIN_SEEDS.filter((s) => s.group === group);
  const contents = CONTENT_SEEDS.filter((s) => s.group === group);
  if (group === 'A2') {
    // A2 全序：钩子 → 发布任务 → 产生疑问 → 找到方法 → 会前准备 → AI团队开会 → 检验提交
    //           → 作品墙 → 认知思考 → 梦想墙 → 未来展开 → 最后升华
    const keys = ['a2:hook', 'a2:s1', 'a2:s2', 'a2:s3', 'a2:s4', 'a2:s5', 'a2:s6', 'a2:wall', 'a2:s7', 'a2:s8', 'a2:s9', 'a2:s10'];
    return keys
      .map((k) => {
        const b = builtins.find((x) => x.refKey === k);
        if (b) return { refKey: b.refKey, kind: 'builtin' as const };
        const c = contents.find((x) => x.refKey === k);
        if (c) return { refKey: c.refKey, kind: 'content' as const };
        return null;
      })
      .filter(Boolean) as { refKey: string | null; kind: 'builtin' | 'content' }[];
  }
  // 其它组：内置页在前、内容页种子在后
  return [
    ...builtins.map((b) => ({ refKey: b.refKey, kind: 'builtin' as const })),
    ...contents.map((c) => ({ refKey: c.refKey, kind: 'content' as const })),
  ];
}

// 内容页种子：写入默认内容块（仅当该页 slot 还没有任何内容块时）
async function seedDefaultBlocksIfEmpty(pageId: string, cs: ContentSeedDef) {
  const slot = `page:${pageId}`;
  const count = await prisma.mediaItem.count({ where: { slot } });
  if (count > 0 || cs.blocks.length === 0) return;
  await prisma.$transaction(
    cs.blocks.map((b, i) =>
      prisma.mediaItem.create({
        data: {
          title: b.title ?? cs.title,
          kind: b.kind,
          url: b.url ?? null,
          content: b.content ?? null,
          slot,
          sort: i,
          align: 'center',
          hidden: false,
        },
      }),
    ),
  );
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
  if (group === 'A3') return 'A3_WORLD';
  if (group === 'CLOSING') return 'CLOSING';
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

// 删除：仅内容页可删（内置页 + 内容页种子受保护）。同时清掉其内容块（MediaItem slot=page:{id}）。
export async function deletePage(id: string) {
  const page = await prisma.lessonPage.findUnique({ where: { id } });
  if (!page) return { ok: false, reason: '页不存在' };
  if (page.kind === 'builtin') return { ok: false, reason: '内置功能页不可删除（可隐藏）' };
  if (page.kind === 'content' && page.refKey) return { ok: false, reason: '内置内容页不可删除（可隐藏）' };
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
