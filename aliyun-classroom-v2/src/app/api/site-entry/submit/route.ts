import { NextRequest, NextResponse } from 'next/server';
import { submitA2 } from '@/features/siteEntry/store';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const title = String(body.title ?? '');
    if (!anonymousId || !sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const participant = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!participant) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 403 });
    await submitA2(sessionId, anonymousId, title);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
