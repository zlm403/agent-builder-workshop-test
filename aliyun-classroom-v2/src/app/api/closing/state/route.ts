import { NextResponse } from 'next/server';
import { getClosingState, setClosingActive, setClosingBeat } from '@/lib/closing';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? '';
  return NextResponse.json(getClosingState(sessionId));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    active?: boolean;
    beatIdx?: number;
  };
  const sessionId = body.sessionId ?? '';
  if (typeof body.active === 'boolean') setClosingActive(sessionId, body.active);
  if (typeof body.beatIdx === 'number') setClosingBeat(sessionId, body.beatIdx);
  return NextResponse.json(getClosingState(sessionId));
}
