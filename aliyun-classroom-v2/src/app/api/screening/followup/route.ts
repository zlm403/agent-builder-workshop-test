export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { submitScreeningFollowup } from '../../../../lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const { anonymousId, followupAnswer } = await req.json();
    if (!anonymousId || !followupAnswer) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: '缺少 anonymousId 或 followupAnswer' } },
        { status: 400 },
      );
    }
    const judgment = await submitScreeningFollowup(anonymousId, followupAnswer);
    return NextResponse.json(judgment);
  } catch (e: any) {
    const code = e?.message || 'UNKNOWN';
    const status =
      code === 'MODULE_LOCKED' ? 409 : code === 'INVALID_TOKEN' ? 401 : code === 'NO_FIRST_ANSWER' ? 400 : 400;
    return NextResponse.json({ error: { code, message: code } }, { status });
  }
}
