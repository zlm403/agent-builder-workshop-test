import { NextRequest, NextResponse } from 'next/server';
import { submitModule } from '@/lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId || '');
    const moduleId = String(body.moduleId || '');
    if (!anonymousId || !moduleId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }
    const result = await submitModule(anonymousId, moduleId, body.data ?? null);
    return NextResponse.json(result);
  } catch (err) {
    const message = String(err);
    const code = message.includes('MODULE_LOCKED')
      ? 'MODULE_LOCKED'
      : message.includes('MODULE_NOT_ACTIVE')
        ? 'MODULE_NOT_ACTIVE'
        : message.includes('INVALID_TOKEN')
          ? 'INVALID_TOKEN'
          : 'SUBMIT_FAILED';
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }
}
