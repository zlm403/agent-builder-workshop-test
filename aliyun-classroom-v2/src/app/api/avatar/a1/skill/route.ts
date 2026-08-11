import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1 } from '@/features/avatarLesson/store';
import { generateAvatar } from '@/features/avatarLesson/ai';
import type { A1ChatTurn } from '@/features/avatarLesson/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const rec = await ensureA1Record(sessionId, anonymousId);
    const chatLog: A1ChatTurn[] = (rec.chatLog as A1ChatTurn[] | null) ?? [];
    const { profile, skill } = await generateAvatar(chatLog);
    await updateA1(sessionId, anonymousId, { profileJson: profile as object, skillText: skill });
    return NextResponse.json({ profile, skill });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
