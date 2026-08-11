import { NextRequest, NextResponse } from 'next/server';
import { getA0Analytics } from '@/features/avatarLesson/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'MISSING_SESSION' } }, { status: 400 });
    const data = await getA0Analytics(sessionId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
