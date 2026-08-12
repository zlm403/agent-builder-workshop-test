import { NextRequest, NextResponse } from 'next/server';
import { getP3Analytics } from '@/features/growGame/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'MISSING_SESSION' } }, { status: 400 });
    const data = await getP3Analytics(sessionId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}