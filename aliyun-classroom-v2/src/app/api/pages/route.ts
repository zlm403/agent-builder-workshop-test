import { NextRequest, NextResponse } from 'next/server';
import {
  PAGE_GROUPS,
  listPages,
  createContentPage,
  updatePage,
  reorderPages,
  deletePage,
  type PageGroup,
} from '@/lib/pages';

export const dynamic = 'force-dynamic';

function parseGroup(v: string | null): PageGroup | null {
  if (!v) return null;
  return (PAGE_GROUPS as readonly string[]).includes(v) ? (v as PageGroup) : null;
}

export async function GET(req: NextRequest) {
  try {
    const group = parseGroup(req.nextUrl.searchParams.get('group'));
    if (!group) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'group 必填（A0/A1/A2）' } }, { status: 400 });
    }
    const pages = await listPages(group);
    return NextResponse.json({ pages });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const group = parseGroup(body.group);
    if (!group) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'group 必填' } }, { status: 400 });
    }
    const page = await createContentPage(group, body.afterId ?? null, String(body.title ?? '').trim());
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id ?? '');

    // 重排：只需 group + order，不需要 id
    if (Array.isArray(body.order)) {
      const group = parseGroup(body.group);
      if (!group) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
      const pages = await reorderPages(group, body.order.map(String));
      return NextResponse.json({ pages });
    }

    if (!id) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });

    const patch: Partial<{ title: string; hidden: boolean; seq: number; overrides: Record<string, string> | null }> = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
    if (typeof body.seq === 'number') patch.seq = body.seq;
    if (body.overrides !== undefined) patch.overrides = body.overrides;
    const page = await updatePage(id, patch);
    return NextResponse.json({ page });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (!id) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const res = await deletePage(id);
    if (!res.ok) return NextResponse.json({ error: { code: 'FORBIDDEN', message: res.reason } }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
