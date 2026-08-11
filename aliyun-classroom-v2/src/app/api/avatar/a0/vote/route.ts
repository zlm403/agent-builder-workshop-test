import { NextRequest, NextResponse } from 'next/server';
import { saveA0Vote } from '@/features/avatarLesson/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const relation = String(body.relation ?? '');
    if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    const res = await saveA0Vote(anonymousId, relation as 'tool' | 'partner');
    if (body.sessionId) publish(String(body.sessionId), { type: 'analytics:update', payload: {} });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: { code: e.message || 'SERVER' } }, { status: e.message === 'MODULE_LOCKED' ? 423 : e.message === 'MODULE_NOT_ACTIVE' ? 409 : 500 });
  }
}
