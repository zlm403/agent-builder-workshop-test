export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { upsertLife, readControl } from '@/lib/world/store';

// 学生提交/更新生命（V1 或 V2 草稿）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sid = String(body.anonymousId || '');
  const name = String(body.name || '').trim();
  const color = String(body.color || '#36CFC9');
  const version = Number(body.version || 1);
  const social = clamp01(Number(body.social));
  const helpful = clamp01(Number(body.helpful));
  const cautious = clamp01(Number(body.cautious));

  if (!sid || !name) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'anonymousId and name required' } }, { status: 400 });
  }

  const control = readControl();
  // creating 阶段只收 V1；revising 阶段只收 V2
  if (control.status === 'creating' && version !== 1) {
    return NextResponse.json({ error: { code: 'WRONG_VERSION', message: '当前阶段只接受 V1' } }, { status: 400 });
  }
  if (control.status === 'revising' && version !== 2) {
    return NextResponse.json({ error: { code: 'WRONG_VERSION', message: '当前阶段只接受 V2' } }, { status: 400 });
  }

  const lives = upsertLife(sid, { name, color, version, social, helpful, cautious });
  const my = lives.lives.find((l) => l.sid === sid);
  return NextResponse.json({ ok: true, life: my });
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}
