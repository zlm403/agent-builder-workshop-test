export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await prisma.classSession.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, inviteCode: true, status: true },
    });
    if (!session) return NextResponse.json({ error: 'NO_SESSION' }, { status: 404 });
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
