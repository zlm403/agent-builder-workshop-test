import { NextRequest, NextResponse } from 'next/server';
import { getScreeningAnalytics } from '@/lib/screening';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const data = await getScreeningAnalytics(sessionId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: { code: 'SCREENING_FAILED', message: String(err) } }, { status: 500 });
  }
}
