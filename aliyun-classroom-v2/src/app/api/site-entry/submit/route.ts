import { NextRequest, NextResponse } from 'next/server';
import { ensureP2Record, updateP2, markP2Progress } from '@/features/siteEntry/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const finalWork = String(body.finalWork ?? '').trim();
    if (!anonymousId || !sessionId || !finalWork) {
      return NextResponse.json({ error: { code: 'MISSING' } }, { status: 400 });
    }
    await ensureP2Record(sessionId, anonymousId);
    await updateP2(sessionId, anonymousId, {
      finalWork,
      step: 6,
      submittedAt: new Date(),
    });
    await markP2Progress(sessionId, anonymousId, 'P2_SITE', { finalWork });
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}