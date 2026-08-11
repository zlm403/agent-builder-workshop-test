// 学员分析 Skill（代码层）
// 职责：收集 A0（三问 + 关系题投票）+ A1（数字分身六步 + 画像/Skill/作品）的学员信息
//      → 分析学员能力与意向 → 产出可同步给销售顾问的简报。
// 教师端「复制销售简报」即调用本模块。

import { prisma } from './db';

export type SalesPriority = 'high' | 'mid' | 'low';

export interface StudentAnalysis {
  anonymousId: string;
  wechatName: string | null; // 微信昵称（用于销售定位到人）
  nickname: string | null; // 学生自填昵称（无微信授权时的身份标识）
  relation: 'tool' | 'partner' | null; // A0 关系题：工具 / 伙伴
  a0Answer: string | null; // 三问之一（用 q1 作代表）
  avatarDone: boolean; // 是否完成 A1 六步 + 定稿
  dream: string | null; // 步1 梦想
  persona: string | null; // LLM 生成的画像一句话
  finalText: string | null; // 朋友圈定稿（作品）
  interestSignal: number; // 0-5（由完成度与文本长度推断，供销售跟进）
  salesPriority: SalesPriority;
  note: string;
}

/** 展示用标识：优先微信昵称，其次学生自填昵称，最后匿名编号。例：小林(A023) */
export function displayName(a: { wechatName: string | null; nickname: string | null; anonymousId: string }): string {
  const name = a.wechatName ?? a.nickname;
  return name ? `${name}(${a.anonymousId})` : a.anonymousId;
}

function asAny(v: unknown): Record<string, any> {
  return (v as Record<string, any>) ?? {};
}

export async function analyzeStudents(sessionId: string): Promise<StudentAnalysis[]> {
  const [a0s, a1s, participants] = await Promise.all([
    prisma.a0New.findMany({ where: { sessionId } }),
    prisma.a1Avatar.findMany({ where: { sessionId } }),
    prisma.participant.findMany({ where: { sessionId } }),
  ]);

  const a0Map = new Map(a0s.map((s) => [s.anonymousId, s]));
  const a1Map = new Map(a1s.map((s) => [s.anonymousId, s]));

  const list: StudentAnalysis[] = [];
  for (const p of participants) {
    const a0 = a0Map.get(p.anonymousId);
    const a1 = a1Map.get(p.anonymousId);
    const answers = asAny(a0?.answers);
    const profile = asAny(a1?.profileJson);
    const avatarDone = !!(a1?.finalText && (a1.step ?? 0) >= 6);
    const dream = a1?.dream ?? null;
    const persona =
      typeof profile?.traits === 'string'
        ? profile.traits
        : Array.isArray(profile?.traits)
          ? (profile.traits as string[]).join('、')
          : null;
    const finalText = a1?.finalText ?? null;
    const relation = (a0?.relation as 'tool' | 'partner') || null;

    // 兴趣信号 0-5：A0 三问作答 + A1 完成度 + 作品长度
    let interest = 0;
    if (answers.q1 || answers.q2 || answers.q3) interest += 1;
    if (answers.q2) interest += 1;
    if (a0?.relation) interest += 1;
    if (avatarDone) interest += 2;
    interest = Math.min(5, interest);

    // 销售优先级
    let priority: SalesPriority = 'low';
    let note = '';
    if (avatarDone && relation === 'partner') {
      priority = 'high';
      note = '深度共创：完成数字分身六步并把梦想做成作品，视 AI 为伙伴，是付费转化的重点对象。';
    } else if (avatarDone) {
      priority = 'mid';
      note = '完成了六步作品但关系题选「工具」，可引导从“偶尔使用”走向“长期伙伴”。';
    } else if (interest >= 2) {
      priority = 'mid';
      note = '有作答与参与，但未走完全程，需持续培育与案例触达。';
    } else {
      note = '当前参与度偏弱，可轻量跟进。';
    }

    list.push({
      anonymousId: p.anonymousId,
      wechatName: p.wechatName,
      nickname: p.nickname,
      relation,
      a0Answer: (answers.q1 as string) ?? null,
      avatarDone,
      dream,
      persona,
      finalText,
      interestSignal: interest,
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
  partnerCount: number;
  toolCount: number;
  avatarDoneCount: number;
  highPriority: string[];
}

export async function buildSalesBrief(sessionId: string): Promise<SalesBrief> {
  const analyses = await analyzeStudents(sessionId);
  const total = analyses.length;
  const submitted = analyses.filter((a) => a.relation || a.a0Answer).length;
  const partnerCount = analyses.filter((a) => a.relation === 'partner').length;
  const toolCount = analyses.filter((a) => a.relation === 'tool').length;
  const avatarDoneCount = analyses.filter((a) => a.avatarDone).length;
  const highPriority = analyses.filter((a) => a.salesPriority === 'high').map((a) => displayName(a));
  const high = analyses.filter((a) => a.salesPriority === 'high');

  const lines: string[] = [];
  lines.push('【销售简报 · AI 体验课（A0 关系题 + A1 数字分身）】');
  lines.push(`课堂人数：${total}　已参与：${submitted}`);
  lines.push(`关系题投票：把 AI 当工具 ${toolCount} 人 / 当伙伴 ${partnerCount} 人`);
  lines.push(`完成数字分身六步并定稿作品：${avatarDoneCount} 人`);
  lines.push('');

  lines.push('一、深度共创（销售顾问优先联系，已附微信昵称）：');
  high.forEach((a) =>
    lines.push(
      `· ${displayName(a)}：关系「${a.relation === 'partner' ? '伙伴' : '工具'}」，画像：${a.persona || '—'}，作品：${(a.finalText || '').slice(0, 60)}——${a.note}`,
    ),
  );
  if (high.length === 0) lines.push('· 暂无');

  lines.push('');
  lines.push('二、作品墙精选（可作为转化素材 / 朋友圈展示）：');
  analyses
    .filter((a) => a.finalText)
    .slice(0, 5)
    .forEach((a) => lines.push(`· ${displayName(a)}：${(a.finalText || '').slice(0, 80)}`));
  if (avatarDoneCount === 0) lines.push('· 暂无');

  lines.push('');
  lines.push('三、给销售顾问的衔接话术：');
  lines.push('· 对选「工具」的学员：先共情“你和 AI 还只是打个照面”，再引出如何让这段关系变深——从偶尔使用走向一起把梦想做成。');
  lines.push('· 对完成数字分身的学员：肯定其深度共创，展示其作品，推荐进阶 Agent 工作流训练或内推。');
  lines.push('· 普遍切入点：用 A0 的真实回答 + A1 的梦想/作品作为诊断起点，自然过渡到报名正式课。');

  return {
    text: lines.join('\n'),
    total,
    submitted,
    partnerCount,
    toolCount,
    avatarDoneCount,
    highPriority,
  };
}
