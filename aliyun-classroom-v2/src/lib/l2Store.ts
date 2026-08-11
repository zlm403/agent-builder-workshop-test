// 第二关过程数据：每人每课堂一份，存于 ModuleProgress（moduleId='A06_TRY'）。
// 这样 4 个模块共享同一份连贯 JSON，避免快照散落、便于教师端汇总。

import { prisma } from './db';
import { COURSE_VERSION } from './courseConfig';
import type { L2ProcessData, SkillVersion } from './types';

export const L2_OWNER_MODULE = 'A06_TRY';

export function emptyL2Process(sessionId: string, studentId: string): L2ProcessData {
  const blankSkill: SkillVersion = {
    understand: '',
    judge: '',
    execute: '',
    sourcePriorityRule: '',
    feedback: '',
  };
  return {
    schemaVersion: 1,
    courseId: COURSE_VERSION,
    sessionId,
    studentId,
    currentModule: 'L2_INTRO',
    moduleSubState: '',
    knowledgeBase: {
      initialSelection: [],
      selectionLogs: [],
      initialSnapshot: {},
      firstRunReferences: [],
      finalSelection: [],
      finalSnapshot: {},
      secondRunReferences: [],
    },
    skill: {
      initialVersion: { ...blankSkill },
      phraseTokensUsed: [],
      revisionLogs: [],
      finalVersion: { ...blankSkill },
    },
    revisions: [],
    interactionLogs: [],
  };
}

export async function getL2Process(sessionId: string, participantId: string): Promise<L2ProcessData> {
  const row = await prisma.moduleProgress.findUnique({
    where: { participantId_moduleId: { participantId, moduleId: L2_OWNER_MODULE } },
  });
  if (!row?.data) return emptyL2Process(sessionId, participantId);
  return (row.data as unknown as L2ProcessData) ?? emptyL2Process(sessionId, participantId);
}

export async function saveL2Process(
  participantId: string,
  sessionId: string,
  data: L2ProcessData,
): Promise<void> {
  await prisma.moduleProgress.upsert({
    where: { participantId_moduleId: { participantId, moduleId: L2_OWNER_MODULE } },
    create: {
      participantId,
      sessionId,
      moduleId: L2_OWNER_MODULE,
      status: 'entered',
      data: data as object,
    },
    update: { data: data as object },
  });
}
