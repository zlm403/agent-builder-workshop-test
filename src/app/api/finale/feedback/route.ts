import { NextRequest, NextResponse } from 'next/server';
import { submitFinaleFeedback } from '@/lib/classroom';

// POST：访问者为某产品提交反馈（评分 + 留言）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, companyId, anonymousId, rating, comment } = body as {
      sessionId: string;
      companyId: string;
      anonymousId: string;
      rating?: number;
      comment?: string;
    };
    if (!sessionId || !companyId || !anonymousId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }
    await submitFinaleFeedback(
      sessionId,
      companyId,
      anonymousId,
      typeof rating === 'number' ? Math.max(1, Math.min(5, rating)) : undefined,
      comment ? comment.slice(0, 500) : undefined
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: { code: 'FEEDBACK_FAILED', message: String(err) } }, { status: 500 });
  }
}
