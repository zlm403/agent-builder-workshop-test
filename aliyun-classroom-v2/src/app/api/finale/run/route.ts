export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { runCompanyChain } from '@/lib/finale';

// POST锛氳闂€呭悜鏌愪釜浜у搧鍙戦€佷竴鍙ヨ瘽闇€姹傦紝瑙﹀彂 4-Agent 閾惧紡杩愯
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, anonymousId, message } = body as {
      companyId: string;
      anonymousId: string;
      message: string;
    };
    if (!companyId || !message || !message.trim()) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '闇€瑕?companyId 涓?message' } }, { status: 400 });
    }
    const result = await runCompanyChain(companyId, anonymousId, message.trim());
    return NextResponse.json({
      steps: result.steps,
      final: result.final,
      mock: result.mock,
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'RUN_FAILED', message: String(err) } }, { status: 500 });
  }
}
