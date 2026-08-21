import { NextRequest, NextResponse } from 'next/server';
import { PAGE_GROUPS, listPages, type PageGroup } from '@/lib/pages';
import { CONTENT_SLOTS } from '@/lib/slots';

export const dynamic = 'force-dynamic';

// 返回全部真实可插入位置（教师端媒体库下拉用）：
//   命名 slot（内置功能页固定位，大屏组件硬编码渲染）+ 内容页动态 slot（page:{id}）
// 内容页永远跟随最新章节走：listPages 拉 DB 实时页面序列，教师增删页面后下拉自动更新。
export async function GET(req: NextRequest) {
  try {
    const groups: {
      group: PageGroup;
      name: string;
      slots: { key: string; label: string; kind: 'named' | 'page' }[];
    }[] = [];

    for (const group of PAGE_GROUPS) {
      const named = CONTENT_SLOTS.filter((s) => s.group === group).map((s) => ({
        key: s.key,
        label: s.label,
        kind: 'named' as const,
      }));
      const pages = await listPages(group);
      const pageSlots = pages
        .filter((p) => p.kind === 'content' && !p.hidden)
        .map((p) => ({
          key: `page:${p.id}`,
          label: `${p.title || '新页面'}（内容页）`,
          kind: 'page' as const,
        }));
      groups.push({
        group,
        name: group,
        slots: [...named, ...pageSlots],
      });
    }

    return NextResponse.json({ groups });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
