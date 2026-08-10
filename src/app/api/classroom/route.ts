export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClassroom } from '@/lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const teacherId = typeof body.teacherId === 'string' ? body.teacherId : 'teacher-default';
    const version = typeof body.version === 'string' ? body.version : 'A';
    let scheduledStartAt: Date | null = null;
    if (typeof body.scheduledStartAt === 'string' && body.scheduledStartAt) {
      const d = new Date(body.scheduledStartAt);
      if (!Number.isNaN(d.getTime())) scheduledStartAt = d;
    }
    const session = await createClassroom(teacherId, version, scheduledStartAt);
    return NextResponse.json({
      id: session.id,
      inviteCode: session.inviteCode,
      status: session.status,
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CREATE_FAILED', message: String(err) } }, { status: 500 });
  }
}
