export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { submitScreening } from '@/lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId || '');
    const answer = String(body.answer || '');
    if (!anonymousId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }
    const judgment = await submitScreening(anonymousId, answer);
    return NextResponse.json(judgment);
  } catch (err) {
    const message = String(err);
    const code = message.includes('MODULE_LOCKED')
      ? 'MODULE_LOCKED'
      : message.includes('MODULE_NOT_ACTIVE')
        ? 'MODULE_NOT_ACTIVE'
        : message.includes('INVALID_TOKEN')
          ? 'INVALID_TOKEN'
          : message.includes('EMPTY_ANSWER')
            ? 'EMPTY_ANSWER'
            : 'SUBMIT_FAILED';
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }
}
