import { prisma } from './db';
import { generateInviteCode, generateResumeToken, generateAnonymousId } from './ids';
import { publish } from './realtime';
import {
  ensureTemplate,
  getModules,
  findModule,
  getModuleIndex,
} from './courseConfig';
import type { ModuleStatus, CourseTemplateData } from './types';
import { judgeAnswer, refineJudgment } from './screening';
import type { ScreeningJudgment } from './screening';

// ===== getSessionState 内存缓存 =====
// 防止高频轮询（教师端/大屏）把 pgbouncer 单连接打满
const _stateCache = new Map<string, { data: any; ts: number }>();
const STATE_CACHE_TTL = 30000; // 30 秒缓存（单次查询本身就要 ~28s，TTL 必须大于查询耗时才有效）

async function audit(sessionId: string, actor: string, action: string, target?: string, detail?: unknown) {
  await prisma.auditLog
    .create({ data: { sessionId, actor, action, target: target ?? null, detail: detail as object } })
    .catch(() => {});
}

async function emitProgress(sessionId: string) {
  // 所有写操作末尾都会调 emitProgress 推送进度，这里统一清状态缓存，
  // 确保教师/大屏下次轮询 getSessionState 能拿到最新数据（P0-4: 缓存写后失效）。
  invalidateSessionCache(sessionId);
  const summary = await getProgressSummary(sessionId);
  publish(sessionId, { type: 'progress:update', payload: summary });
}

// A03 子状态（running/compare）通过原生 SQL 读写，避免重新生成 Prisma 客户端
async function readModuleSubState(sessionId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ moduleSubState: string | null }[]>(
      'SELECT "moduleSubState" FROM "ClassSession" WHERE id = $1', sessionId,
    );
    return rows[0]?.moduleSubState ?? null;
  } catch {
    return null;
  }
}

async function writeModuleSubState(sessionId: string, value: string | null) {
  await prisma.$executeRawUnsafe(
    'UPDATE "ClassSession" SET "moduleSubState" = $1 WHERE id = $2', value, sessionId,
  );
}

// ---------- 课堂生命周期 ----------

export async function createClassroom(teacherId = 'teacher-default', version = 'A', scheduledStartAt?: Date | null) {
  const tpl = await ensureTemplate(version);
  const inviteCode = await generateInviteCode();
  const startAt = scheduledStartAt ?? new Date(Date.now() + 10 * 60 * 1000);
  const session = await prisma.classSession.create({
    data: { templateId: tpl.id, teacherId, inviteCode, scheduledStartAt: startAt },
  });
  await audit(session.id, 'teacher', 'classroom:create', undefined, { version });
  publish(session.id, { type: 'classroom:created', payload: { sessionId: session.id } });
  return session;
}

export async function startClassroom(sessionId: string) {
  const tpl = await ensureTemplate();
  const modules = getModules(tpl);
  const first = modules[0]?.id ?? null;
  const session = await prisma.classSession.update({
    where: { id: sessionId },
    data: {
      status: 'active',
      currentModuleId: first,
      startedAt: new Date(),
      moduleStartedAt: new Date(),
      // 第一个模块若是 A0 三问，初始 subState 落在开场·手指图
      moduleSubState: first === 'A0N_QUESTIONS' ? 'a0:intro1' : null,
    },
  });
  await audit(sessionId, 'teacher', 'classroom:start');
  publish(sessionId, { type: 'module:advanced', payload: { moduleId: first } });
  await emitProgress(sessionId);
  return session;
}

export async function advanceClassroom(sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const tpl = await ensureTemplate();
  const modules = getModules(tpl);
  const idx = getModuleIndex(tpl, session.currentModuleId ?? '');
  const next = modules[idx + 1]?.id ?? session.currentModuleId;
  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { currentModuleId: next, moduleStartedAt: new Date() },
  });
  await writeModuleSubState(sessionId, null);
  await audit(sessionId, 'teacher', 'module:advance', next);
  publish(sessionId, { type: 'module:advanced', payload: { moduleId: next } });
  await emitProgress(sessionId);
  return updated;
}

export async function jumpClassroom(sessionId: string, targetModuleId: string) {
  const tpl = await ensureTemplate();
  const mod = findModule(tpl, targetModuleId);
  if (!mod) throw new Error('MODULE_NOT_FOUND');
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { currentModuleId: targetModuleId, moduleStartedAt: new Date() },
  });
  await writeModuleSubState(sessionId, null);
  await audit(sessionId, 'teacher', 'module:jump', targetModuleId);
  publish(sessionId, { type: 'module:advanced', payload: { moduleId: targetModuleId } });
  await emitProgress(sessionId);
  return updated;
}

/** 重置课堂：清空参与者/进度/邀请码，回到等待开始状态（不自动生成邀请码）。 */
export async function resetClassroom(_sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: _sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');

  // 按外键依赖顺序清理明细数据（含学生回答），事务包裹保证中途失败不留半删数据（P0-2）
  const updated = await prisma.$transaction(async (tx) => {
    await tx.moduleProgress.deleteMany({ where: { sessionId: _sessionId } });
    const parts = await tx.participant.findMany({ where: { sessionId: _sessionId }, select: { id: true } });
    if (parts.length) {
      await tx.a0Screening.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
      await tx.a0New.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
      await tx.a1Avatar.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
      await tx.entryThought.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
      await tx.consentRecord.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
    }
    await tx.participant.deleteMany({ where: { sessionId: _sessionId } });
    await tx.classInvitation.deleteMany({ where: { sessionId: _sessionId } });

    return tx.classSession.update({
      where: { id: _sessionId },
      data: {
        status: 'pending',
        currentModuleId: null,
        moduleLocked: false,
        moduleStartedAt: null,
        startedAt: null,
        endedAt: null,
      },
    });
  });
  await writeModuleSubState(_sessionId, null);

  await audit(_sessionId, 'teacher', 'classroom:reset');
  publish(_sessionId, { type: 'classroom:reset', payload: {} });
  await emitProgress(_sessionId);
  return updated;
}

/**
 * 关闭课堂：释放本场所有学生（清理进度与参与者记录），锁定模块并标记已结束，
 * 同时通知学生端/大屏退回“加入/等待”状态。关闭后该课堂码不可再加入。
 */
export async function endClassroom(sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');

  // 释放学生：按依赖顺序清理明细数据（consentRecord 随 participant 级联），事务包裹（P0-2）
  const updated = await prisma.$transaction(async (tx) => {
    await tx.moduleProgress.deleteMany({ where: { sessionId } });
    const parts = await tx.participant.findMany({ where: { sessionId }, select: { id: true } });
    if (parts.length) {
      await tx.consentRecord.deleteMany({ where: { participantId: { in: parts.map((p) => p.id) } } });
    }
    await tx.participant.deleteMany({ where: { sessionId } });

    return tx.classSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        moduleLocked: true,
        endedAt: new Date(),
        moduleStartedAt: null,
      },
    });
  });

  await audit(sessionId, 'teacher', 'classroom:close');
  publish(sessionId, { type: 'classroom:closed', payload: {} });
  await emitProgress(sessionId);
  return updated;
}

export async function setLock(sessionId: string, locked: boolean) {
  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { moduleLocked: locked },
  });
  await audit(sessionId, 'teacher', 'module:lock', undefined, { locked });
  // setLock 不走 emitProgress，单独清缓存（P0-4）
  invalidateSessionCache(sessionId);
  publish(sessionId, { type: 'module:locked', payload: { locked } });
  return updated;
}

export async function setModuleSubState(sessionId: string, subState: string | null) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  await writeModuleSubState(sessionId, subState);
  await audit(sessionId, 'teacher', 'module:substate', undefined, { subState });
  publish(sessionId, { type: 'module:substate', payload: { subState } });
  await emitProgress(sessionId);
  return session;
}

/** 教师端触发大屏视频控制（瞬态广播：不写数据库、不改 subState，只推送给大屏立即执行）
 *  action: 'play' 播放（需 url） | 'pause' 暂停 | 'stop' 停止 */
export interface VideoCommand { action: 'play' | 'pause' | 'stop'; url?: string }
export async function broadcastPlayVideo(sessionId: string, cmd: VideoCommand) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  await audit(sessionId, 'teacher', 'module:playvideo', undefined, cmd);
  publish(sessionId, { type: 'module:playvideo', payload: cmd });
  return session;
}

/** 重置指定模块的全班进度（清业务表 + 该模块 moduleProgress + subState 回到第一步），用于重新开始本环节。 */
export async function resetModuleProgress(sessionId: string, moduleId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const parts = await prisma.participant.findMany({ where: { sessionId }, select: { id: true } });
  const partIds = parts.map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (moduleId === 'A1_AVATAR') {
      if (partIds.length) await tx.a1Avatar.deleteMany({ where: { participantId: { in: partIds } } });
    } else if (moduleId === 'A0N_QUESTIONS' || moduleId === 'A0N_VOTE' || moduleId === 'A0N_REVEAL') {
      if (partIds.length) await tx.a0New.deleteMany({ where: { participantId: { in: partIds } } });
    } else if (moduleId === 'A2_SITE') {
      if (partIds.length) await tx.a2SiteEntry.deleteMany({ where: { participantId: { in: partIds } } });
    }
    // 该模块的提交进度一并清掉（重新开始后 moduleStatus 回到 pending）
    await tx.moduleProgress.deleteMany({ where: { sessionId, moduleId } });
  });

  // subState 回到该模块的第一步，让大屏/学生端/教师端统一回到起点
  const initialSubState =
    moduleId === 'A1_AVATAR' ? 'avatar:hook'
    : moduleId === 'A0N_QUESTIONS' ? 'a0:intro1'
    : moduleId === 'A0N_REVEAL' ? 'reveal:1'
    : moduleId === 'A2_SITE' ? 'a2:hook'
    : moduleId === 'A3_WORLD' ? 'world:hook'
    : moduleId === 'CLOSING' ? 'closing:pain:0'
    : null;
  if (initialSubState !== null) await writeModuleSubState(sessionId, initialSubState);

  await audit(sessionId, 'teacher', 'module:reset', moduleId);
  publish(sessionId, { type: 'module:reset', payload: { moduleId } });
  publish(sessionId, { type: 'module:substate', payload: { subState: initialSubState } });
  await emitProgress(sessionId);
  return session;
}

// ---------- 学生入场 ----------

export async function joinClassroom(
  inviteCode: string,
  options: {
    nickname?: string;
    wechatName?: string;
    wechatOpenid?: string;
    invitationCode?: string;
    deviceInfo?: unknown;
    consentPrivacy?: boolean;
  } = {}
) {
  const { nickname, wechatName, wechatOpenid, invitationCode, deviceInfo, consentPrivacy = true } = options;
  const session = await prisma.classSession.findUnique({ where: { inviteCode } });
  if (!session) throw new Error('INVALID_CODE');
  if (session.status === 'closed' || session.status === 'ended') throw new Error('SESSION_CLOSED');

  let invitation: { id: string; used: boolean } | null = null;
  if (invitationCode) {
    invitation = await prisma.classInvitation.findUnique({
      where: { sessionId_code: { sessionId: session.id, code: invitationCode.toUpperCase() } },
    });
    if (!invitation) throw new Error('INVALID_INVITATION');
    if (invitation.used) throw new Error('INVITATION_USED');
  }

  const tpl = await ensureTemplate();
  const anonymousId = await generateAnonymousId(session.id, tpl.version);
  const resumeToken = generateResumeToken();

  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      anonymousId,
      nickname: wechatName ?? nickname ?? null,
      wechatName: wechatName ?? null,
      wechatOpenid: wechatOpenid ?? null,
      resumeToken,
      deviceInfo: deviceInfo as object,
    },
  });

  if (invitation) {
    // 原子占用邀请码：仅当仍为未使用状态时才置为已用，防止并发两个学生同码都通过检查（P0-3）
    const claimed = await prisma.classInvitation.updateMany({
      where: { id: invitation.id, used: false },
      data: { used: true, usedByParticipantId: participant.id },
    });
    if (claimed.count === 0) {
      // 竞态：已被他人占用，回滚刚创建的参与者，避免产生孤立的 participant 记录
      await prisma.participant.delete({ where: { id: participant.id } });
      throw new Error('INVITATION_USED');
    }
  }

  if (consentPrivacy) {
    await prisma.consentRecord.create({
      data: { participantId: participant.id, consentType: 'privacy', granted: true },
    });
  }

  // 标记进入当前模块
  if (session.currentModuleId) {
    await upsertProgress(participant.id, session.id, session.currentModuleId, 'entered');
  }

  await audit(session.id, `student:${anonymousId}`, 'student:join', undefined, {
    invitationCode: invitationCode || null,
  });
  publish(session.id, { type: 'student:joined', payload: { anonymousId } });
  await emitProgress(session.id);

  return {
    anonymousId,
    resumeToken,
    sessionId: session.id,
    nickname: wechatName ?? nickname ?? null,
    wechatName: wechatName ?? null,
    currentModuleId: session.currentModuleId,
  };
}

function makeInvitationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export async function generateInvitations(sessionId: string, count: number) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const codes = new Set<string>();
  while (codes.size < count) codes.add(makeInvitationCode());
  const existing = new Set(
    (await prisma.classInvitation.findMany({ where: { sessionId }, select: { code: true } })).map((i) => i.code)
  );
  const newCodes = Array.from(codes).filter((c) => !existing.has(c));
  if (newCodes.length === 0) return [];
  await prisma.classInvitation.createMany({
    data: newCodes.map((code) => ({ sessionId, code })),
    skipDuplicates: true,
  });
  return newCodes;
}

export async function getInvitations(sessionId: string) {
  const [invitations, total, used] = await Promise.all([
    prisma.classInvitation.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } }),
    prisma.classInvitation.count({ where: { sessionId } }),
    prisma.classInvitation.count({ where: { sessionId, used: true } }),
  ]);
  return { invitations, total, used };
}

export async function resumeSession(resumeToken: string) {
  const p = await prisma.participant.findUnique({ where: { resumeToken } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  await prisma.participant.update({
    where: { id: p.id },
    data: { connected: true, lastSeenAt: new Date() },
  });
  return {
    anonymousId: p.anonymousId,
    sessionId: p.sessionId,
    nickname: p.nickname,
    inviteCode: session?.inviteCode ?? null,
    currentModuleId: session?.currentModuleId ?? null,
    moduleLocked: session?.moduleLocked ?? false,
  };
}

// ---------- 模块进度 ----------

async function upsertProgress(
  participantId: string,
  sessionId: string,
  moduleId: string,
  status: ModuleStatus,
  data?: unknown
) {
  await prisma.moduleProgress.upsert({
    where: { participantId_moduleId: { participantId, moduleId } },
    create: {
      participantId,
      sessionId,
      moduleId,
      status,
      submittedAt: status === 'submitted' ? new Date() : null,
      data: data as object,
    },
    update: {
      status,
      submittedAt: status === 'submitted' ? new Date() : undefined,
      data: data as object,
    },
  });
}

export async function submitModule(anonymousId: string, moduleId: string, data: unknown) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');
  if (session.currentModuleId !== moduleId) throw new Error('MODULE_NOT_ACTIVE');

  await upsertProgress(p.id, p.sessionId, moduleId, 'submitted', data);
  await audit(p.sessionId, `student:${anonymousId}`, 'module:submit', moduleId);
  await emitProgress(p.sessionId);

  return { status: 'submitted', nextActions: ['wait_for_teacher'] };
}

// ---------- A0 环节：AI 标签（一个主问题 + 一次针对性追问） ----------

export async function submitScreening(anonymousId: string, answer: string) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'active') throw new Error('MODULE_NOT_ACTIVE');
  if (session.currentModuleId !== 'A0_SCREENING') throw new Error('MODULE_NOT_ACTIVE');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');

  const trimmed = (answer || '').trim();
  if (!trimmed) throw new Error('EMPTY_ANSWER');

  // 确定性规则判定 + 生成针对性追问（后续可改为调用真实 LLM）
  const judgment = judgeAnswer(trimmed);

  // 同时写入模块进度（供刷新恢复）与专用 A0 表（供分析/销售）
  await upsertProgress(p.id, p.sessionId, 'A0_SCREENING', 'submitted', {
    answer: trimmed,
    screening: judgment,
    step: 1,
  });

  await prisma.a0Screening.upsert({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
    update: {
      answer: trimmed,
      wordCount: judgment.wordCount,
      aiLabel: judgment.label,
      judgmentJson: judgment as object,
      interestSignal: judgment.interestSignal,
    },
    create: {
      sessionId: p.sessionId,
      anonymousId,
      participantId: p.id,
      answer: trimmed,
      wordCount: judgment.wordCount,
      aiLabel: judgment.label,
      judgmentJson: judgment as object,
      interestSignal: judgment.interestSignal,
    },
  });

  await audit(p.sessionId, `student:${anonymousId}`, 'a0_screening_submit', 'A0_SCREENING', {
    label: judgment.label,
  });
  await emitProgress(p.sessionId);
  publish(p.sessionId, { type: 'analytics:update', payload: {} });

  return judgment;
}

// 第二问：提交对 AI 追问的回答，合并两轮证据给出最终“当前标签”
export async function submitScreeningFollowup(anonymousId: string, followupAnswer: string) {
  const p = await prisma.participant.findUnique({ where: { anonymousId } });
  if (!p) throw new Error('INVALID_TOKEN');
  const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status !== 'active') throw new Error('MODULE_NOT_ACTIVE');
  if (session.currentModuleId !== 'A0_SCREENING') throw new Error('MODULE_NOT_ACTIVE');
  if (session.moduleLocked) throw new Error('MODULE_LOCKED');

  const trimmed = (followupAnswer || '').trim();
  if (!trimmed) throw new Error('EMPTY_ANSWER');

  const rec = await prisma.a0Screening.findUnique({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
  });
  if (!rec) throw new Error('NO_FIRST_ANSWER');

  const first = (rec.judgmentJson as unknown as ScreeningJudgment) ?? judgeAnswer(rec.answer);
  const finalJudgment = refineJudgment(first, trimmed);

  await upsertProgress(p.id, p.sessionId, 'A0_SCREENING', 'submitted', {
    answer: rec.answer,
    screening: first,
    followup: { text: first.followup.text, answer: trimmed },
    finalJudgment,
    step: 2,
  });

  await prisma.a0Screening.update({
    where: { sessionId_anonymousId: { sessionId: p.sessionId, anonymousId } },
    data: {
      followupQuestion: first.followup.text,
      followupAnswer: trimmed,
      aiLabel: finalJudgment.label,
      followupJson: finalJudgment as object,
    },
  });

  await audit(p.sessionId, `student:${anonymousId}`, 'a0_screening_followup', 'A0_SCREENING', {
    label: finalJudgment.label,
  });
  await emitProgress(p.sessionId);
  publish(p.sessionId, { type: 'analytics:update', payload: {} });

  return finalJudgment;
}

// ---------- 进度汇总 ----------

export interface ProgressSummary {
  sessionId: string;
  status: string;
  currentModuleId: string | null;
  moduleLocked: boolean;
  moduleSubState: string | null;
  totalStudents: number;
  onlineStudents: number;
  totalSubmitted: number; // 全部模块累计提交（completed + submitted）
  overview: {
    moduleId: string;
    title: string;
    completed: number;
    inProgress: number;
    stuck: number;
    notStarted: number;
  }[];
  helpRequests: number;
}

export async function getProgressSummary(sessionId: string): Promise<ProgressSummary> {
  // 并行化所有独立 DB 查询
  const [session, tpl, participants, progress, moduleSubState] = await Promise.all([
    prisma.classSession.findUnique({ where: { id: sessionId } }),
    ensureTemplate(),
    prisma.participant.findMany({ where: { sessionId } }),
    prisma.moduleProgress.findMany({ where: { sessionId } }),
    readModuleSubState(sessionId),
  ]);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const modules = getModules(tpl);
  const totalStudents = participants.length;
  const onlineStudents = participants.filter((p) => p.connected).length;

  const overview = modules.map((m) => {
    const rows = progress.filter((r) => r.moduleId === m.id);
    return {
      moduleId: m.id,
      title: m.title,
      completed: rows.filter((r) => r.status === 'completed' || r.status === 'submitted').length,
      inProgress: rows.filter((r) => r.status === 'entered').length,
      stuck: rows.filter((r) => r.status === 'stuck').length,
      notStarted: totalStudents - rows.length,
    };
  });

  return {
    sessionId,
    status: session.status,
    currentModuleId: session.currentModuleId,
    moduleLocked: session.moduleLocked,
    moduleSubState, // 已在并行查询中获取
    totalStudents,
    onlineStudents,
    totalSubmitted: progress.filter((r) => r.status === 'completed' || r.status === 'submitted').length,
    overview,
    helpRequests: 0,
  };
}

/** 当前课堂全量状态（供教师/大屏初始化渲染）。带 30 秒内存缓存 + 并行查询，防止高频轮询打满 pgbouncer。 */
export async function getSessionState(sessionId: string) {
  // 检查缓存
  const cached = _stateCache.get(sessionId);
  if (cached && Date.now() - cached.ts < STATE_CACHE_TTL) {
    return cached.data;
  }

  // 并行执行所有独立 DB 查询，将串行 ~28s 降低到单次查询耗时 (~8-10s)
  const [session, tpl, summary] = await Promise.all([
    prisma.classSession.findUnique({ where: { id: sessionId } }),
    ensureTemplate(),
    getProgressSummary(sessionId),
  ]);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const modules = getModules(tpl);
  const current = findModule(tpl, session.currentModuleId);

  const result = {
    id: session.id,
    inviteCode: session.inviteCode,
    courseName: tpl.name,
    createdAt: session.createdAt?.toISOString() ?? null,
    scheduledStartAt: session.scheduledStartAt?.toISOString() ?? null,
    status: session.status,
    currentModuleId: session.currentModuleId,
    moduleLocked: session.moduleLocked,
    moduleStartedAt: session.moduleStartedAt?.toISOString() ?? null,
    modules,
    currentModule: current,
    summary,
  };

  // 写入缓存
  _stateCache.set(sessionId, { data: result, ts: Date.now() });
  return result;
}

/** 清除指定课堂的状态缓存（控制操作后调用，确保下次拉取最新数据） */
export function invalidateSessionCache(sessionId: string) {
  _stateCache.delete(sessionId);
}