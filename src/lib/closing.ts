// 收官运行时：内存存储 + 实时同步。
// 与 finale / A0 体系解耦，不新建数据库表；单实例课堂足够。
// 多实例部署时把 realtime 换成 Supabase / Redis 即可。

import { publish, subscribe, type RealtimeEvent } from './realtime';

export interface ClosingAnswer {
  anonymousId: string;
  name: string | null;
  questionId: string;
  text: string;
  values?: string[]; // 选择题：选中的选项（文本）
  ts: number;
}

const g = globalThis as typeof globalThis & {
  __closingAnswers?: Record<string, ClosingAnswer[]>;
  __closingEnroll?: Record<string, number>;
};

if (!g.__closingAnswers) g.__closingAnswers = {};
if (!g.__closingEnroll) g.__closingEnroll = {};

const answersOf = (sessionId: string) => (g.__closingAnswers![sessionId] ??= []);
const enrollOf = (sessionId: string) => (g.__closingEnroll![sessionId] ?? 0);

export const CLOSING_EVENT = 'closing:update';

function notify(sessionId: string, payload: RealtimeEvent['payload']) {
  publish(sessionId, { type: CLOSING_EVENT, payload });
}

export function addClosingAnswer(
  sessionId: string,
  a: Omit<ClosingAnswer, 'ts'>,
): ClosingAnswer {
  const list = answersOf(sessionId);
  // 同一学员同一题只保留最新一条
  const idx = list.findIndex(
    (x) => x.anonymousId === a.anonymousId && x.questionId === a.questionId,
  );
  const full: ClosingAnswer = { ...a, ts: Date.now() };
  if (idx >= 0) list[idx] = full;
  else list.push(full);
  notify(sessionId, { kind: 'answer', questionId: a.questionId });
  return full;
}

export function getClosingAnswers(sessionId: string): ClosingAnswer[] {
  return [...answersOf(sessionId)].sort((x, y) => y.ts - x.ts);
}

export function setEnroll(sessionId: string, count: number): number {
  const n = Math.max(0, Math.floor(count || 0));
  g.__closingEnroll![sessionId] = n;
  notify(sessionId, { kind: 'enroll', count: n });
  return n;
}

export function getEnroll(sessionId: string): number {
  return enrollOf(sessionId);
}

/** 订阅收官实时更新，返回取消订阅函数。handler 在每次更新时被调用（参数为事件）。 */
export function subscribeClosing(
  sessionId: string,
  handler: (e: RealtimeEvent) => void,
): () => void {
  return subscribe(sessionId, handler);
}

// ============ 收官阶段总控（active + 当前节拍） ============
// 用于把收官内容推到「常规课堂」大屏 / 学生页（不再开独立新窗口）。
const cg = globalThis as typeof globalThis & {
  __closingState?: Record<string, { active: boolean; beatIdx: number }>;
};
if (!cg.__closingState) cg.__closingState = {};

const closingStateOf = (sessionId: string) =>
  (cg.__closingState![sessionId] ??= { active: false, beatIdx: 0 });

export const CLOSING_ENTER = 'closing:enter';
export const CLOSING_EXIT = 'closing:exit';
export const CLOSING_BEAT = 'closing:beat';

export function setClosingActive(sessionId: string, active: boolean): void {
  closingStateOf(sessionId).active = active;
  publish(sessionId, { type: active ? CLOSING_ENTER : CLOSING_EXIT, payload: { active } });
}

export function setClosingBeat(sessionId: string, beatIdx: number): void {
  closingStateOf(sessionId).beatIdx = beatIdx;
  publish(sessionId, { type: CLOSING_BEAT, payload: { beatIdx } });
}

export function getClosingState(sessionId: string): { active: boolean; beatIdx: number } {
  return { ...closingStateOf(sessionId) };
}
