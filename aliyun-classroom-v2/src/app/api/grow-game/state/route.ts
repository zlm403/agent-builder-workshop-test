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
        trait: null,
        traitWhy: null,
        lifeDesign: null,
        lifeNotes: null,
        finalWork: null,
      });
    }
    return NextResponse.json({
      step: rec.step,
      chatLog: rec.chatLog ?? [],
      objectName: rec.objectName,
      trait: rec.trait,
      traitWhy: rec.traitWhy,
      lifeDesign: rec.lifeDesign,
      lifeNotes: rec.lifeNotes,
      finalWork: rec.finalWork,
      submittedAt: rec.submittedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
