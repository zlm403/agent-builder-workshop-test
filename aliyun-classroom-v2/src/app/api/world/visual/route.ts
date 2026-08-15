export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readVisual, setVisual } from '@/lib/world/store';

// 大屏环境光斑整体速度/亮度（教师调节，大屏读取）
// GET：大屏轮询读取
// POST：教师设置 { speed, brightness }
export async function GET() {
  return NextResponse.json(readVisual());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const speed = Number(body.speed);
  const brightness = Number(body.brightness);
  if (Number.isNaN(speed) || Number.isNaN(brightness)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'speed and brightness required' } }, { status: 400 });
  }
  const visual = setVisual(speed, brightness);
  return NextResponse.json({ visual });
}
