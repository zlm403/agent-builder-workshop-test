export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { resumeSession } from '@/lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const resumeToken = String(body.resumeToken || '');
    if (!resumeToken) return NextResponse.json({ error: { code: 'TOKEN_REQUIRED' } }, { status: 400 });
    const result = await resumeSession(resumeToken);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: { code: 'RESUME_FAILED', message: String(err) } }, { status: 400 });
  }
}
