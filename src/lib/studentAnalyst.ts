// 学员分析 Skill（代码层）
// 职责：收集 A0 应聘自检 + A01 基线任务的学员信息 → 分析学员能力与意向 → 产出可同步给销售顾问的简报。
// 这是“收集信息、分析学员、与销售顾问配合”的核心模块，教师端「复制销售简报」即调用本模块。

import { prisma } from './db';
import { type AiLabel, LABEL_TEXT } from './screening';

export type SalesPriority = 'high' | 'mid' | 'low';

export interface StudentAnalysis {
  anonymousId: string;
  wechatName: string | null; // 微信昵称（与 anonymousId 一一对应，用于销售定位到人）
  a0Label: AiLabel | null; // AI 面试后的“当前标签”
  interestSignal: number; // 0-5
  a0Answer: string | null;
  a01AiStyle: string | null; // A01 真实任务中的 AI 使用方式
  a01Clarity: string | null; // A01 任务清晰度
  salesPriority: SalesPriority; // 销售跟进优先级
  note: string; // 给销售顾问的画像说明
}

/** 展示用标识：优先微信昵称，其次匿名编号。例：微信昵称(A023) */
export function displayName(a: { wechatName: string | null; anonymousId: string }): string {
  return a.wechatName ? `${a.wechatName}(${a.anonymousId})` : a.anonymousId;
}

/** A0 标签的对外展示文案 */
export function labelLabel(label: AiLabel | null): string {
  if (label) return LABEL_TEXT[label];
  return '未提交';
}

function asAny(v: unknown): Record<string, any> {
  return (v as Record<string, any>) ?? {};
}

export async function analyzeStudents(sessionId: string): Promise<StudentAnalysis[]> {
  const [screenings, a01, participants] = await Promise.all([
    prisma.a0Screening.findMany({ where: { sessionId } }),
    prisma.moduleProgress.findMany({ where: { sessionId, moduleId: 'A01_BASELINE' } }),
    prisma.participant.findMany({ where: { sessionId } }),
  ]);

  const screeningMap = new Map(screenings.map((s) => [s.participantId, s]));
  const a01ByParticipant = new Map(a01.map((p) => [p.participantId, asAny(p.data)]));

  const list: StudentAnalysis[] = [];
  for (const p of participants) {
    const s = screeningMap.get(p.id);
    const a1 = a01ByParticipant.get(p.id);
    const a0Label = (s?.aiLabel as AiLabel) || null;
    const interest = s?.interestSignal ?? 0;
    const a01AiStyle = a1?.profile?.aiStyle ?? a1?.aiStyle ?? null;
    const a01Clarity = a1?.profile?.taskClarity ?? a1?.taskClarity ?? null;

    // 销售优先级：高意向 + 非应用创造者 = 重点转化；已具应用/系统能力 = 推进阶/内推；其余轻量跟进
    let priority: SalesPriority = 'low';
    let note = '';
    if (interest >= 3 && a0Label !== 'app_creator') {
      priority = 'high';
      note = '高意向待转化：对课程有兴趣，但当前能力偏“工具型”，是付费转化的重点对象。';
    } else if (a0Label === 'app_creator') {
      priority = 'mid';
      note = '已具应用/系统能力，适合推荐进阶 Agent 工作流训练或内推机会。';
    } else if (interest >= 3) {
      priority = 'mid';
      note = '意向中等，需持续培育与案例触达。';
    } else {
      note = '当前意向与能力均偏弱，可轻量跟进。';
    }

    list.push({
      anonymousId: p.anonymousId,
      wechatName: p.wechatName,
      a0Label,
      interestSignal: interest,
      a0Answer: s?.answer ?? null,
      a01AiStyle,
      a01Clarity,
      salesPriority: priority,
      note,
    });
  }
  // 高意向 / 高优先级排前
  list.sort((a, b) => {
    const rank = (x: SalesPriority) => (x === 'high' ? 0 : x === 'mid' ? 1 : 2);
    if (rank(a.salesPriority) !== rank(b.salesPriority)) return rank(a.salesPriority) - rank(b.salesPriority);
    return b.interestSignal - a.interestSignal;
  });
  return list;
}

export interface SalesBrief {
  text: string;
  total: number;
  submitted: number;
  toolUser: number;
  taskSolver: number;
  appCreator: number;
  highInterestCount: number;
  highPriority: string[];
}

export async function buildSalesBrief(sessionId: string): Promise<SalesBrief> {
  const analyses = await analyzeStudents(sessionId);
  const total = analyses.length;
  const submitted = analyses.filter((a) => a.a0Label).length;
  const toolUser = analyses.filter((a) => a.a0Label === 'tool_user').length;
  const taskSolver = analyses.filter((a) => a.a0Label === 'task_solver').length;
  const appCreator = analyses.filter((a) => a.a0Label === 'app_creator').length;
  const highInterest = analyses.filter((a) => a.interestSignal >= 3);
  const highPriority = analyses.filter((a) => a.salesPriority === 'high').map((a) => displayName(a));

  const interestAvg = submitted > 0 ? Math.round((analyses.reduce((s, a) => s + a.interestSignal, 0) / submitted) * 10) / 10 : 0;

  const lines: string[] = [];
  lines.push('【销售简报 · AI 试听课 A0 面试】');
  lines.push(`课堂人数：${total}　已参与 A0 面试：${submitted}`);
  lines.push(`AI 标签分布：工具体验者 ${toolUser} 人 / 任务解决者 ${taskSolver} 人 / 应用创造者 ${appCreator} 人`);
  lines.push(`平均兴趣信号：${interestAvg} / 5`);
  lines.push('');

  lines.push('一、高意向待转化（销售顾问优先联系，已附微信昵称）：');
  highInterest.forEach((a) =>
    lines.push(`· ${displayName(a)}：兴趣 ${a.interestSignal}/5，A0 标签「${labelLabel(a.a0Label)}」——${a.note}`),
  );
  if (highInterest.length === 0) lines.push('· 暂无');

  lines.push('');
  lines.push('二、已具应用/系统能力（建议进阶课程 / 内推）：');
  analyses
    .filter((a) => a.a0Label === 'app_creator')
    .forEach((a) => lines.push(`· ${displayName(a)}：兴趣 ${a.interestSignal}/5 —— ${a.note}`));
  if (appCreator === 0) lines.push('· 暂无');

  lines.push('');
  lines.push('三、给销售顾问的衔接话术：');
  lines.push('· 对“工具体验者”学员：先共情“AI 面试官说你的用法还停留在工具层”，再引出我们如何把工具型用法升级成系统/流程型能力。');
  lines.push('· 对“应用创造者”学员：肯定其系统思维，推荐进阶 Agent 工作流训练或内推。');
  lines.push('· 普遍切入点：用 A0 的“真实回答”作为诊断起点，自然过渡到报名正式课。');

  return {
    text: lines.join('\n'),
    total,
    submitted,
    toolUser,
    taskSolver,
    appCreator,
    highInterestCount: highInterest.length,
    highPriority,
  };
}
