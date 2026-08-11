import { NextRequest, NextResponse } from 'next/server';
import { getProgressSummary } from '@/lib/classroom';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const summary = await getProgressSummary(params.sessionId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: { code: 'PROGRESS_FAILED', message: String(err) } }, { status: 404 });
  }
}
