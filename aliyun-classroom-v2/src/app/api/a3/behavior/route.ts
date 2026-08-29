import { NextRequest, NextResponse } from 'next/server';
import { interpretBehavior, ruleBehavior } from '@/lib/world/behavior';

// =========================================================
// A3 《我的世界》行为解释端点
// 学生端六块设计 → AI 综合解释成 behavior v1 说明书（白名单过闸）。
// 学生端提交生命前调用本端点拿 behavior，再随 /api/a3/world/life 提交。
// 失败（无 key/超时）自动规则回退，永远返回 ok+behavior，不阻断前端。
// =========================================================

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const six = body.sixBlocks || body.skill || body.convos || {};
  try {
    const behavior = await interpretBehavior(six);
    return NextResponse.json({ ok: true, behavior });
  } catch {
    return NextResponse.json({ ok: true, behavior: ruleBehavior(six) });
  }
}
