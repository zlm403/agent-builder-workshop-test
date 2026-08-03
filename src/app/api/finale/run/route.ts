import { NextRequest, NextResponse } from 'next/server';
import { runCompanyChain } from '@/lib/finale';

// POST：访问者向某个产品发送一句话需求，触发 4-Agent 链式运行
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, anonymousId, message } = body as {
      companyId: string;
      anonymousId: string;
      message: string;
    };
    if (!companyId || !message || !message.trim()) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '需要 companyId 与 message' } }, { status: 400 });
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
