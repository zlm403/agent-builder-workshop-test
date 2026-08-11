// 集中答疑运行时：内存存储 + 实时统计 + 讲解状态机。
// 与 closing / finale / A0 解耦，不依赖任何 Node / 服务端模块，可被客户端组件安全 import（仅类型）。
// 多实例部署时把内存换成 Supabase / Redis 即可。

import { QA_QUESTIONS } from './closingConfig';

export type QAStatus = 'idle' | 'explaining' | 'done';

export interface QAState {
  activeQuestionId: string | null; // 当前正在大屏讲解的问题
  status: QAStatus;
  rank: number | null; // 讲解激活时该问题的排名（用于大屏 TOP N）
  answered: string[]; // 已讲完的问题（降低优先级、标记已解答）
  frozenOrder: string[] | null; // 讲解开始即锁定排序（questionId 数组）
}

export interface QATally {
  id: string;
  count: number;
  pct: number; // 占已提交人数的百分比
}

interface QAVoteStore {
  votes: Map<string, string[]>; // anonymousId -> 选中的 questionId 列表
}

const g = globalThis as typeof globalThis & {
  __qaVotes?: Record<string, QAVoteStore>;
  __qaState?: Record<string, QAState>;
};

if (!g.__qaVotes) g.__qaVotes = {};
if (!g.__qaState) g.__qaState = {};

const votesOf = (s: string) => (g.__qaVotes![s] ??= { votes: new Map() });

const stateOf = (s: string): QAState =>
  (g.__qaState![s] ??= {
    activeQuestionId: null,
    status: 'idle',
    rank: null,
    answered: [],
    frozenOrder: null,
  });

// 学生投票（替换式，天然不重复累计）。答疑开始后锁定，不再接收。
export function addQaVote(
  sessionId: string,
  anonymousId: string,
  selected: string[],
): { accepted: boolean; reason?: 'locked'; selected?: string[] } {
  const st = stateOf(sessionId);
  if (st.status !== 'idle') {
    return { accepted: false, reason: 'locked' };
  }
  const valid = Array.isArray(selected)
    ? selected
        .filter((id) => QA_QUESTIONS.some((q) => q.id === id))
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .slice(0, 3)
    : [];
  votesOf(sessionId).votes.set(anonymousId, valid);
  return { accepted: true, selected: valid };
}

// 实时统计（按人数降序，稳定排序）
export function tallyQa(sessionId: string): { list: QATally[]; submitters: number } {
  const v = votesOf(sessionId).votes;
  const counts: Record<string, number> = {};
  QA_QUESTIONS.forEach((q) => (counts[q.id] = 0));
  let submitters = 0;
  v.forEach((sel) => {
    if (sel.length) submitters += 1;
    sel.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  });
  const list: QATally[] = QA_QUESTIONS.map((q) => ({
    id: q.id,
    count: counts[q.id] || 0,
    pct: submitters ? Math.round(((counts[q.id] || 0) / submitters) * 100) : 0,
  }));
  list.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return { list, submitters };
}

// 讲师点「我要讲这个」：大屏切换 + 锁定排名
export function presentQa(sessionId: string, questionId: string): QAState {
  const st = stateOf(sessionId);
  const { list } = tallyQa(sessionId);
  const idx = list.findIndex((x) => x.id === questionId);
  st.activeQuestionId = questionId;
  st.rank = idx >= 0 ? idx + 1 : null;
  st.status = 'explaining';
  st.frozenOrder = list.map((x) => x.id); // 开始讲解即锁定当前排序，避免界面乱跳
  return st;
}

// 讲完 / 稍后再讲：回到排行榜
export function finishQa(sessionId: string, questionId: string, markAnswered: boolean): QAState {
  const st = stateOf(sessionId);
  if (markAnswered && questionId && !st.answered.includes(questionId)) {
    st.answered.push(questionId);
  }
  st.activeQuestionId = null;
  st.rank = null;
  st.status = 'idle';
  return st;
}

// 解锁排名（教师手动）
export function unlockQa(sessionId: string): QAState {
  const st = stateOf(sessionId);
  st.frozenOrder = null;
  return st;
}

export function getQaState(sessionId: string): QAState {
  return stateOf(sessionId);
}
