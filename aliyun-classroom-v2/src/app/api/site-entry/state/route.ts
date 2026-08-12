import { NextRequest, NextResponse } from 'next/server';
import { getP2Record } from '@/features/siteEntry/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const anonymousId = String(req.nextUrl.searchParams.get('anonymousId') ?? '');
    if (!sessionId || !anonymousId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const rec = await getP2Record(sessionId, anonymousId);
    if (!rec) {
      return NextResponse.json({
        step: 1,
        chatLog: [],
        field: null,
        entryTask: null,
        skeleton: null,
        keyDiff: null,
        sitePlan: null,
        siteCode: null,
        testNote: null,
        finalWork: null,
      });
    }
    return NextResponse.json({
      step: rec.step,
      chatLog: rec.chatLog ?? [],
      field: rec.field,
      entryTask: rec.entryTask,
      skeleton: rec.skeleton,
      keyDiff: rec.keyDiff,
      sitePlan: rec.sitePlan,
      siteCode: rec.siteCode,
      testNote: rec.testNote,
      finalWork: rec.finalWork,
      submittedAt: rec.submittedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}