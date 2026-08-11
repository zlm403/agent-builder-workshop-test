export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getL2Process, saveL2Process } from '@/lib/l2Store';
import type { L2ProcessData } from '@/lib/types';

export async function GET(req: NextRequest) {
  const anonymousId = req.nextUrl.searchParams.get('anonymousId');
  if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_TOKEN' } }, { status: 400 });
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });
  const process = await getL2Process(p.sessionId, p.id);
  return NextResponse.json({ process });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId: string = String(body.anonymousId ?? '');
    const patch: Partial<L2ProcessData> = body.patch ?? {};
    if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_TOKEN' } }, { status: 400 });

    const p = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });

    const data = await getL2Process(p.sessionId, p.id);
    const merged: L2ProcessData = { ...data, ...patch };
    if (patch.knowledgeBase) merged.knowledgeBase = { ...data.knowledgeBase, ...patch.knowledgeBase };
    if (patch.skill) merged.skill = { ...data.skill, ...patch.skill };
    if (patch.firstRun) merged.firstRun = patch.firstRun;
    if (patch.secondRun) merged.secondRun = patch.secondRun;
    if (patch.aiCheck) merged.aiCheck = patch.aiCheck;
    if (patch.revisions) merged.revisions = [...data.revisions, ...patch.revisions];
    if (patch.interactionLogs)
      merged.interactionLogs = [...data.interactionLogs, ...patch.interactionLogs];
    merged.sessionId = p.sessionId;
    merged.studentId = p.id;

    await saveL2Process(p.id, p.sessionId, merged);
    return NextResponse.json({ process: merged });
  } catch (err) {
    return NextResponse.json({ error: { code: 'L2_PROCESS_FAILED', message: String(err) } }, { status: 500 });
  }
}

// 鍓嶇 L2StudentFlow.save() / finish() 鐢?PUT 鏁翠綋瑕嗙洊淇濆瓨杩囩▼鏁版嵁
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId: string = String(body.anonymousId ?? '');
    const incoming = body.data as L2ProcessData | undefined;
    if (!anonymousId || !incoming) {
      return NextResponse.json({ error: { code: 'MISSING_TOKEN' } }, { status: 400 });
    }
    const p = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });
    incoming.sessionId = p.sessionId;
    incoming.studentId = p.id;
    await saveL2Process(p.id, p.sessionId, incoming);
    return NextResponse.json({ process: incoming });
  } catch (err) {
    return NextResponse.json({ error: { code: 'L2_PROCESS_FAILED', message: String(err) } }, { status: 500 });
  }
}
