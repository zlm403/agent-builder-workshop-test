import { NextRequest, NextResponse } from 'next/server';

// =========================================================
// A3 共生缸（我的世界）世界后端
// 内存存储学员生命；与系统身份解耦：studentId 由学生端 iframe
// 透传系统的 anonymousId。旧 WorldScreen/engine 的三倾向模型不再用于 A3。
// 注意：内存存储，进程重启会清空（与试听课演示场景一致）。
// =========================================================

export const dynamic = 'force-dynamic';

const lives = new Map<string, any>();

export async function GET() {
  return NextResponse.json({ ok: true, lives: [...lives.values()] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.studentId) {
    return NextResponse.json({ ok: false, error: 'studentId required' }, { status: 400 });
  }
  const rec = {
    code: body.code || 'SYM-207',
    name: body.name,
    hue: body.hue,
    dims: body.dims,
    skill: body.skill,
    creator: body.creator || '学员',
    studentId: body.studentId,
    bornAt: Date.now(),
  };
  lives.set(body.studentId, rec);
  return NextResponse.json({ ok: true, lives: [...lives.values()] });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.all) {
    lives.clear();
  } else if (body.studentId) {
    lives.delete(body.studentId);
  }
  return NextResponse.json({ ok: true, lives: [...lives.values()] });
}
