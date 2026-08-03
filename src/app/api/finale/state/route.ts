import { NextRequest, NextResponse } from 'next/server';
import {
  getFinaleState,
  enterFinale,
  openFinaleRound,
  closeFinaleRound,
  exitFinale,
  listCompanies,
} from '@/lib/classroom';

// GET：读取终章状态 + 当前轮次已发布的产品列表（仅 active 时返回 companies）
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId') ?? '';
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    const state = await getFinaleState(sessionId);
    const companies = state.active ? await listCompanies(sessionId, state.round) : [];
    return NextResponse.json({
      active: state.active,
      round: state.round,
      open: state.open,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        scene: c.scene,
        ownerName: c.ownerName,
        agents: (c.agents as { nickname: string; role: string }[]).map((a) => ({
          nickname: a.nickname,
          role: a.role,
        })),
        publishedAt: c.publishedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: String(err) } }, { status: 500 });
  }
}

// POST：教师控制（进入终章 / 开本轮 / 关闭本轮 / 退出终章）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId as string;
    const action = body.action as string;
    if (!sessionId) return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });

    let state;
    switch (action) {
      case 'enter':
        state = await enterFinale(sessionId);
        break;
      case 'open':
        state = await openFinaleRound(sessionId);
        break;
      case 'close':
        state = await closeFinaleRound(sessionId);
        break;
      case 'exit':
        state = await exitFinale(sessionId);
        break;
      default:
        return NextResponse.json({ error: { code: 'UNKNOWN_ACTION' } }, { status: 400 });
    }
    return NextResponse.json({ active: state.active, round: state.round, open: state.open });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CONTROL_FAILED', message: String(err) } }, { status: 400 });
  }
}
