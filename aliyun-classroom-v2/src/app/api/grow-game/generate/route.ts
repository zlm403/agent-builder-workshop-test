import { NextRequest, NextResponse } from 'next/server';
import { ensureP3Record, updateP3 } from '@/features/growGame/store';
import { generateP3Game, p3JudgeWork } from '@/features/growGame/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const mode = String(body.mode ?? 'generate'); // generate | judge
    const rec = await ensureP3Record(sessionId, anonymousId);

    if (mode === 'generate') {
      const { code } = await generateP3Game({
        objectName: String(rec.objectName ?? ''),
        growthDef: String(rec.growthDef ?? ''),
        coreRules: String(rec.coreRules ?? ''),
        events: String(rec.events ?? ''),
        endings: String(rec.endings ?? ''),
      });
      await updateP3(sessionId, anonymousId, { gameCode: code, step: 6 });
      return NextResponse.json({ code });
    }

    // judge：试玩判定（只存试玩结论与暂存文本，不标记提交）
    const finalWork = String(body.finalWork ?? '');
    const testNote = String(body.testNote ?? '');
    if (!finalWork) return NextResponse.json({ error: { code: 'EMPTY' } }, { status: 400 });
    const judgment = await p3JudgeWork(finalWork);
    await updateP3(sessionId, anonymousId, {
      testNote: testNote || judgment.note,
      finalWork,
      step: 6,
    });
    return NextResponse.json(judgment);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}