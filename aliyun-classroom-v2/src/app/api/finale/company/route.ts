export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { publishCompany, listCompanies, type FinaleAgent } from '@/lib/classroom';

// POST：学生发布自己的 4-Agent 产品
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, anonymousId, scene, name, agents } = body as {
      sessionId: string;
      anonymousId: string;
      scene: string;
      name?: string;
      agents?: FinaleAgent[];
    };
    if (!sessionId || !anonymousId || !scene || !Array.isArray(agents) || agents.length !== 4) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '需要 sessionId/anonymousId/scene/agents(4)' } }, { status: 400 });
    }
    const owner = await prismaOwner(anonymousId);
    const company = await publishCompany(
      sessionId,
      anonymousId,
      owner,
      scene,
      (name || '我的 AI 公司').slice(0, 40),
      agents.map((a) => ({
        role: a.role ?? '',
        nickname: (a.nickname || '').slice(0, 40),
        personality: (a.personality || '').slice(0, 500),
        duty: (a.duty || '').slice(0, 500),
        boundary: (a.boundary || '').slice(0, 500),
        rules: (a.rules || '').slice(0, 500),
        handoff: (a.handoff || '').slice(0, 500),
      }))
    );
    return NextResponse.json({ id: company.id, name: company.name, round: company.round });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('FINALE_NOT_OPEN')) {
      return NextResponse.json({ error: { code: 'NOT_OPEN', message: '本轮尚未开放发布，请等老师说“现在发布”' } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: 'PUBLISH_FAILED', message: msg } }, { status: 500 });
  }
}

// GET：列出当前轮次已发布的产品（供浏览/访问）
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId') ?? '';
    const roundParam = req.nextUrl.searchParams.get('round');
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const companies = await listCompanies(sessionId, roundParam ? Number(roundParam) : undefined);
    return NextResponse.json({
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        scene: c.scene,
        ownerName: c.ownerName,
        agents: (c.agents as FinaleAgent[]).map((a) => ({ role: a.role, nickname: a.nickname })),
        publishedAt: c.publishedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: String(err) } }, { status: 500 });
  }
}

// 取发布者昵称
async function prismaOwner(anonymousId: string): Promise<string | null> {
  const { prisma } = await import('@/lib/db');
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  return p?.nickname ?? null;
}
