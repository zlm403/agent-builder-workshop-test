import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { KNOWLEDGE_DOCS, PERSONAS } from '@/lib/courseConfig';
import { getL2Process, saveL2Process } from '@/lib/l2Store';
import { generateDualRun } from '@/lib/l2Engine';
import type { DualRunResponse, SkillVersion } from '@/lib/types';

function blankSkill(): SkillVersion {
  return { understand: '', judge: '', execute: '', sourcePriorityRule: '', feedback: '' };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId: string = String(body.anonymousId ?? '');
    const action: 'first' | 'second' = body.action === 'second' ? 'second' : 'first';
    const selection: string[] = Array.isArray(body.knowledgeSelection) ? body.knowledgeSelection : [];
    const skill: SkillVersion = { ...blankSkill(), ...(body.skill ?? {}) };

    if (!anonymousId) return NextResponse.json({ error: { code: 'MISSING_TOKEN' } }, { status: 400 });
    // A06 是最终工作台：允许学生未完成 A04/A05 就直接运行
    // 知识库不足 4 份时，后端用已有资料（可能为空）交给引擎，引擎会走离线示例兜底

    const p = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });

    const data = await getL2Process(p.sessionId, p.id);

    // 幂等：同一版本（选择 + Skill）已运行过则直接返回已有结果。
    const prev = action === 'first' ? data.firstRun : data.secondRun;
    const sameSelection =
      JSON.stringify([...selection].sort()) ===
      JSON.stringify([...(action === 'first' ? data.knowledgeBase.initialSelection : data.knowledgeBase.finalSelection)].sort());
    const sameSkill =
      JSON.stringify(skill) ===
      JSON.stringify(action === 'first' ? data.skill.initialVersion : data.skill.finalVersion);
    if (prev && sameSelection && sameSkill) {
      return NextResponse.json({ run: prev as DualRunResponse, cached: true });
    }

    const docs = KNOWLEDGE_DOCS.filter((d) => selection.includes(d.id)).map((d) => ({
      id: d.id,
      title: d.title,
      body: d.body,
    }));

    const run: DualRunResponse = await generateDualRun({ knowledgeDocs: docs, skill, personas: PERSONAS });

    const refIds = Array.from(
      new Set([
        ...run.learnerA.references.map((r) => r.docId),
        ...run.learnerB.references.map((r) => r.docId),
      ]),
    );

    if (action === 'first') {
      data.firstRun = {
        learnerA: run.learnerA,
        learnerB: run.learnerB,
        generationMode: run.generationMode,
      };
      data.knowledgeBase.firstRunReferences = refIds;
    } else {
      data.secondRun = {
        learnerA: run.learnerA,
        learnerB: run.learnerB,
        generationMode: run.generationMode,
      };
      data.knowledgeBase.secondRunReferences = refIds;
    }

    await saveL2Process(p.id, p.sessionId, data);
    return NextResponse.json({ run, cached: false });
  } catch (err) {
    return NextResponse.json({ error: { code: 'L2_RUN_FAILED', message: String(err) } }, { status: 500 });
  }
}
