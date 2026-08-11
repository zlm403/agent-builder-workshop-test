import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1, markProgress } from '@/features/avatarLesson/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const finalText = String(body.finalText ?? '').trim();
    if (!anonymousId || !sessionId || !finalText) {
      return NextResponse.json({ error: { code: 'MISSING' } }, { status: 400 });
    }
    await ensureA1Record(sessionId, anonymousId);
    await updateA1(sessionId, anonymousId, {
      finalText,
      step: 6,
      submittedAt: new Date(),
    });
    await markProgress(sessionId, anonymousId, 'A1_AVATAR', { finalText });
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
