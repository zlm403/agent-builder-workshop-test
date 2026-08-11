export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateInvitations, getInvitations } from '@/lib/classroom';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await getInvitations(params.id);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: { code: 'LOAD_FAILED', message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const count = Number(body.count) || 0;
    if (count < 1 || count > 500) {
      return NextResponse.json({ error: { code: 'INVALID_COUNT' } }, { status: 400 });
    }
    const codes = await generateInvitations(params.id, count);
    return NextResponse.json({ codes, generated: codes.length });
  } catch (err) {
    return NextResponse.json({ error: { code: 'GENERATE_FAILED', message: String(err) } }, { status: 500 });
  }
}
