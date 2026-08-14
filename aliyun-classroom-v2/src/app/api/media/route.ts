import { NextRequest, NextResponse } from 'next/server';
import { listMedia, createMedia, deleteMedia, updateMedia } from '@/lib/mediaStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const slot = req.nextUrl.searchParams.get('slot') ?? undefined;
    const includeHidden = req.nextUrl.searchParams.get('includeHidden') === '1';
    const items = await listMedia(slot, includeHidden);
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body.title ?? '').trim();
    const kind = String(body.kind ?? 'text');
    const url = body.url ? String(body.url).trim() : '';
    const content = body.content ? String(body.content).trim() : '';
    // text 类型必须要有文字内容；image/video/link 必须要有 url
    if (!title) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '标题必填' } }, { status: 400 });
    }
    if (kind === 'text' && !content) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '文字内容不能为空' } }, { status: 400 });
    }
    if (kind !== 'text' && !url) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '请填写地址或上传文件' } }, { status: 400 });
    }
    const item = await createMedia({
      title,
      kind,
      url: url || null,
      content: content || null,
      slot: String(body.slot ?? 'custom'),
      sort: Number(body.sort ?? 0),
      align: String(body.align ?? 'center'),
      hidden: Boolean(body.hidden ?? false),
    });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (!id) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    await deleteMedia(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const item = await updateMedia(id, {
      title: body.title,
      kind: body.kind,
      url: body.url,
      content: body.content,
      slot: body.slot,
      sort: body.sort,
      align: body.align,
      hidden: body.hidden,
    });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
