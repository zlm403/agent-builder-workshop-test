import { NextRequest, NextResponse } from 'next/server';
import { getP3Record } from '@/features/growGame/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const anonymousId = String(req.nextUrl.searchParams.get('anonymousId') ?? '');
    if (!sessionId || !anonymousId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const rec = await getP3Record(sessionId, anonymousId);
    if (!rec) {
      return NextResponse.json({
        step: 1,
        chatLog: [],
        objectName: null,
        growthDef: null,
        coreRules: null,
        events: null,
        endings: null,
        gameCode: null,
        testNote: null,
        finalWork: null,
      });
    }
    return NextResponse.json({
      step: rec.step,
      chatLog: rec.chatLog ?? [],
      objectName: rec.objectName,
      growthDef: rec.growthDef,
      coreRules: rec.coreRules,
      events: rec.events,
      endings: rec.endings,
      gameCode: rec.gameCode,
      testNote: rec.testNote,
      finalWork: rec.finalWork,
      submittedAt: rec.submittedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}