import { NextRequest, NextResponse } from 'next/server';
import {
  addClosingAnswer,
  getClosingAnswers,
} from '@/lib/closing';

export const dynamic = 'force-dynamic';

// GET：取某课堂全部收官回答（用于大屏实时总览）
export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    return NextResponse.json({ answers: getClosingAnswers(sessionId) });
  } catch (err) {
    return NextResponse.json({ error: { code: 'GET_FAILED', message: String(err) } }, { status: 500 });
  }
}

// POST：学生提交收官三问 / 答疑
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, anonymousId, name, questionId, text, values } = body as {
      sessionId: string;
      anonymousId: string;
      name?: string | null;
      questionId: string;
      text?: string;
      values?: string[];
    };
    if (!sessionId || !anonymousId || !questionId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }
    const clean = (text ?? '').toString().slice(0, 600).trim();
    const vals = Array.isArray(values)
      ? values.map((v) => String(v).slice(0, 80)).slice(0, 10)
      : undefined;
    const finalText = clean || (vals ? vals.join('；') : '');
    if (!finalText) {
      return NextResponse.json({ error: { code: 'EMPTY_TEXT' } }, { status: 400 });
    }
    const saved = addClosingAnswer(sessionId, {
      anonymousId,
      name: name ?? null,
      questionId,
      text: finalText,
      values: vals,
    });
    return NextResponse.json({ ok: true, answer: saved });
  } catch (err) {
    return NextResponse.json({ error: { code: 'POST_FAILED', message: String(err) } }, { status: 500 });
  }
}
