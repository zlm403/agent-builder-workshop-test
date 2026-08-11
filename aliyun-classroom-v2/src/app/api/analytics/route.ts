import { NextRequest, NextResponse } from 'next/server';
import { computeClassAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const moduleId = String(req.nextUrl.searchParams.get('moduleId') ?? 'A01_BASELINE');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const analytics = await computeClassAnalytics(sessionId, moduleId);
    return NextResponse.json(analytics);
  } catch (err) {
    return NextResponse.json({ error: { code: 'ANALYTICS_FAILED', message: String(err) } }, { status: 500 });
  }
}
