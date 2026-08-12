import { NextRequest, NextResponse } from 'next/server';
import { ensureP2Record, updateP2 } from '@/features/siteEntry/store';
import { generateP2Site, p2JudgeWork } from '@/features/siteEntry/ai';

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
    const rec = await ensureP2Record(sessionId, anonymousId);

    if (mode === 'generate') {
      const { code } = await generateP2Site({
        field: String(rec.field ?? ''),
        entryTask: String(rec.entryTask ?? ''),
        skeleton: String(rec.skeleton ?? ''),
        keyDiff: String(rec.keyDiff ?? ''),
        sitePlan: String(rec.sitePlan ?? ''),
      });
      await updateP2(sessionId, anonymousId, { siteCode: code, step: 6 });
      return NextResponse.json({ code });
    }

    // judge：小白测试判定（只存测试结论与暂存文本，不标记提交）
    const finalWork = String(body.finalWork ?? '');
    const testNote = String(body.testNote ?? '');
    if (!finalWork) return NextResponse.json({ error: { code: 'EMPTY' } }, { status: 400 });
    const judgment = await p2JudgeWork(finalWork);
    await updateP2(sessionId, anonymousId, {
      testNote: testNote || judgment.note,
      finalWork,
      step: 6,
    });
    return NextResponse.json(judgment);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}