import { NextRequest, NextResponse } from 'next/server';
import { getSessionState } from '@/lib/classroom';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const state = await getSessionState(params.id);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND', message: String(err) } }, { status: 404 });
  }
}
