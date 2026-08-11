import { NextRequest, NextResponse } from 'next/server';
import { getA1Record } from '@/features/avatarLesson/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const anonymousId = String(req.nextUrl.searchParams.get('anonymousId') ?? '');
    if (!sessionId || !anonymousId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const rec = await getA1Record(sessionId, anonymousId);
    if (!rec) {
      return NextResponse.json({
        step: 1,
        chatLog: [],
        skill: null,
        profile: null,
        task: null,
        plan: null,
        drafts: null,
        feedback: null,
        finalText: null,
      });
    }
    return NextResponse.json({
      step: rec.step,
      chatLog: rec.chatLog ?? [],
      skill: rec.skillText,
      profile: rec.profileJson,
      task: rec.task,
      plan: rec.planChoice,
      drafts: rec.drafts ?? null,
      feedback: rec.feedback,
      finalText: rec.finalText,
      submittedAt: rec.submittedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
