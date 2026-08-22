import { NextRequest, NextResponse } from 'next/server';
import { getA2Record } from '@/features/siteEntry/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const anonymousId = String(req.nextUrl.searchParams.get('anonymousId') ?? '');
    if (!sessionId || !anonymousId) return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    const rec = await getA2Record(sessionId, anonymousId);
    return NextResponse.json({
      team: (rec?.team as any[]) ?? [],
      chatLog: (rec?.chatLog as any[]) ?? [],
      siteCode: rec?.siteCode ?? '',
      title: rec?.title ?? '',
      submittedAt: rec?.submittedAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
