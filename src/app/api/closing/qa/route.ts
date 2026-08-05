import { NextResponse } from 'next/server';
import {
  addQaVote,
  tallyQa,
  getQaState,
  presentQa,
  finishQa,
  unlockQa,
} from '@/lib/closingQA';

export const dynamic = 'force-dynamic';

// 学生 / 大屏 / 教师屏 轮询：实时统计 + 当前讲解状态
export async function GET(req: Request) {
  const sid = new URL(req.url).searchParams.get('sessionId');
  if (!sid) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
  const { list, submitters } = tallyQa(sid);
  const state = getQaState(sid);
  return NextResponse.json({ questions: list, submitters, state });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: 'BAD_JSON' } }, { status: 400 });
  }
  const sessionId = body.sessionId as string | undefined;
  const action = body.action as string | undefined;
  if (!sessionId || !action) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
  }

  if (action === 'vote') {
    const anonymousId = body.anonymousId as string | undefined;
    if (!anonymousId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const selected = Array.isArray(body.selected) ? (body.selected as string[]) : [];
    const r = addQaVote(sessionId, anonymousId, selected);
    return NextResponse.json(r);
  }

  if (action === 'present') {
    const questionId = body.questionId as string | undefined;
    if (!questionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    return NextResponse.json(presentQa(sessionId, questionId));
  }

  if (action === 'done' || action === 'later') {
    const questionId = body.questionId as string | undefined;
    return NextResponse.json(finishQa(sessionId, questionId ?? '', action === 'done'));
  }

  if (action === 'unlock') {
    return NextResponse.json(unlockQa(sessionId));
  }

  return NextResponse.json({ error: { code: 'UNKNOWN_ACTION' } }, { status: 400 });
}
