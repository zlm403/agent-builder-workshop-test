import { NextRequest, NextResponse } from 'next/server';
import { saveA0Sliders, getA0SlidersAnalytics } from '@/features/avatarLesson/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sliders = body.sliders ?? {};
    if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    const res = await saveA0Sliders(anonymousId, sliders);
    if (body.sessionId) publish(String(body.sessionId), { type: 'analytics:update', payload: {} });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: e.message || 'SERVER' } },
      { status: e.message === 'MODULE_LOCKED' ? 423 : e.message === 'MODULE_NOT_ACTIVE' ? 409 : 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'MISSING_SESSION' } }, { status: 400 });
    const data = await getA0SlidersAnalytics(sessionId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
