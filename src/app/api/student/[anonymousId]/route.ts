import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureTemplate, findModule } from '@/lib/courseConfig';
import { getStudentAiStyle } from '@/lib/analytics';
import { getFinaleState } from '@/lib/classroom';

export async function GET(_req: NextRequest, { params }: { params: { anonymousId: string } }) {
  try {
    const p = await prisma.participant.findUnique({ where: { anonymousId: params.anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });
    const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
    const tpl = await ensureTemplate();
    const current = findModule(tpl, session?.currentModuleId ?? null);

    const progress = current
      ? await prisma.moduleProgress.findUnique({
          where: { participantId_moduleId: { participantId: p.id, moduleId: current.id } },
        })
      : null;

    // 学员在 A01 的实操分类（一次性 / 多轮 / 流程），驱动 A02/A03 个性化内容
    const aiStyle = await getStudentAiStyle(p.anonymousId, p.sessionId);

    // 状态：教师进入后，学生端据此切换到体验
    const finale = await getFinaleState(p.sessionId);

    return NextResponse.json({
      anonymousId: p.anonymousId,
      nickname: p.nickname,
      sessionId: p.sessionId,
      sessionStatus: session?.status,
      moduleLocked: session?.moduleLocked ?? false,
      moduleStartedAt: session?.moduleStartedAt?.toISOString() ?? null,
      currentModule: current ?? null,
      currentModuleStatus: progress?.status ?? 'pending',
      currentModuleData: progress?.data ?? null,
      aiStyle,
      finale: { active: finale.active, round: finale.round, open: finale.open },
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: String(err) } }, { status: 500 });
  }
}
