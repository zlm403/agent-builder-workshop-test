import { NextRequest, NextResponse } from 'next/server';
import { setEnroll, getEnroll } from '@/lib/closing';

export const dynamic = 'force-dynamic';

// GET：取当前报名人数
export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    return NextResponse.json({ count: getEnroll(sessionId) });
  } catch (err) {
    return NextResponse.json({ error: { code: 'GET_FAILED', message: String(err) } }, { status: 500 });
  }
}

// POST：教师提交报名人数
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, count } = body as { sessionId: string; count?: number };
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const n = setEnroll(sessionId, Number(count ?? 0));
    return NextResponse.json({ ok: true, count: n });
  } catch (err) {
    return NextResponse.json({ error: { code: 'POST_FAILED', message: String(err) } }, { status: 500 });
  }
}
