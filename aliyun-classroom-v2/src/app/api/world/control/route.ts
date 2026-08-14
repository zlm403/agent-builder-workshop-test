export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { transitionControl } from '@/lib/world/store';

// 教师控制：4 个动作，revision 递增防重。
const ACTIONS = ['startCreate', 'startRound1', 'startRevise', 'startRound2', 'finish'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: { code: 'BAD_ACTION', message: action } }, { status: 400 });
  }
  const control = transitionControl(action as Action);
  return NextResponse.json({ control });
}
