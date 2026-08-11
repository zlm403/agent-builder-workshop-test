import { NextRequest, NextResponse } from 'next/server';
import { buildSalesBrief } from '@/lib/studentAnalyst';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const brief = await buildSalesBrief(sessionId);
    return NextResponse.json(brief);
  } catch (err) {
    return NextResponse.json({ error: { code: 'BRIEF_FAILED', message: String(err) } }, { status: 500 });
  }
}
