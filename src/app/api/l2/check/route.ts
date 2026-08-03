import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { KNOWLEDGE_DOCS } from '@/lib/courseConfig';
import { getL2Process, saveL2Process } from '@/lib/l2Store';
import { generateAiCheck, type CheckDocInput } from '@/lib/l2Engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId: string = String(body.anonymousId ?? '');
    if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_TOKEN' } }, { status: 400 });

    const p = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });

    const data = await getL2Process(p.sessionId, p.id);
    if (!data.firstRun) {
      return NextResponse.json({ error: { code: 'NO_FIRST_RUN' } }, { status: 400 });
    }

    const selectedSet = new Set(
      data.knowledgeBase.finalSelection.length
        ? data.knowledgeBase.finalSelection
        : data.knowledgeBase.initialSelection,
    );
    const refA = new Map(data.firstRun.learnerA.references.map((r) => [r.docId, r]));
    const refB = new Map(data.firstRun.learnerB.references.map((r) => [r.docId, r]));

    const docs: CheckDocInput[] = KNOWLEDGE_DOCS.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      updatedAt: d.updatedAt,
      relevance: d.relevance,
      reliability: d.reliability,
      timeliness: d.timeliness,
      selected: selectedSet.has(d.id),
      referencedA: refA.has(d.id),
      referencedB: refB.has(d.id),
      usageA: refA.get(d.id)?.usage,
      usageB: refB.get(d.id)?.usage,
    }));

    const result = await generateAiCheck({ docs, skill: data.skill.finalVersion, firstRun: data.firstRun });

    data.aiCheck = result;
    await saveL2Process(p.id, p.sessionId, data);
    return NextResponse.json({ check: result });
  } catch (err) {
    return NextResponse.json({ error: { code: 'L2_CHECK_FAILED', message: String(err) } }, { status: 500 });
  }
}
