// =========================================================
// 方案三 · 数字生命共生缸 · AI 层（LLM 驱动）
// 未配置 API Key 时代码走内置 mock，保证整套流程可离线演示。
// =========================================================
import { chatWithLLM } from '@/lib/llm';
import type { ChatMessage } from '@/lib/llm';
import type { P3ChatTurn } from './store';

type Role = 'user' | 'assistant';

function asRole(t: P3ChatTurn): Role {
  return t.role === 'user' ? 'user' : 'assistant';
}

function buildHistory(history: P3ChatTurn[]): ChatMessage[] {
  return history.map((h) => ({ role: asRole(h), content: h.content }));
}

// 十阶段引导（s1..s10）· 数字生命共生缸
const STAGE_GUIDES: Record<string, { goal: string; avoid: string; temp?: number }> = {
  s1: {
    temp: 0.3,
    goal:
      '这一步让学生产生创作愿望。学生看大屏"这个世界还没有居民"，准备开始创造。' +
      '你要做的：热情欢迎学生进入创造，问他"你想创造一个怎样的生命？"（可以代表真实的他，也可以是想成为的某部分）。' +
      '不要讲技术，不要讲玩法，就点燃创作欲。',
    avoid: '不要长篇大论，不要讲创造认知，不要替学生想生命。',
  },
  s2: {
    goal:
      '这一步学生选核心特质。学生说出"我想创造一个____的生命"后，你热情接住，复述成一句核心设定' +
      '（例："你想创造一个进入陌生环境后先观察、确认方向再行动的生命，对吗？"）。' +
      '如果学生说"很酷/很强/很特别"，追问具体行为（"你希望别人通过它什么行为看出它很酷？"）。' +
      '学生确认后引导进入下一步（设计规则）。',
    avoid: '不要替学生决定特质，不要展开规则设计。',
  },
  s3: {
    goal:
      '这一步学生设计生命规则（外形/移动/相遇/能力/代价）。学生可能问"怎么设计"或报出选择。' +
      '你把学生报的选择整理成规则（如"移动：缓慢并经常停下；相遇：保持距离确认后靠近；能力：给低能量生命补光；代价：用后变慢"）。' +
      '如果发现规则冲突（如能力太强没代价），指出来并给两个修改方案让学生选。',
    avoid: '不要替学生做决定；每个能力必须有代价。',
  },
  s4: {
    goal:
      '这一步 AI 把设计翻译成可运行的生命规则。你按结构化输出（核心特质/移动规则/相遇规则/特殊能力/能力代价），' +
      '问学生"它的行为体现了你的核心想法吗？能力看得见吗？代价合理吗？"。',
    avoid: '不要自行改变学生的核心特质。',
  },
  s5: {
    goal:
      '这一步学生投入共生缸。学生说投入后，你简短鼓励："去吧，把它放进世界！" 提醒"投入后先观察，不要急着操作"。',
    avoid: '不要长篇，不要替学生分析。',
  },
  s6: {
    goal:
      '这一步学生观察并发现问题。学生说"我看到____"，你追问证据（"你具体看到了什么？是很少互动、能力不明显，还是视觉上难辨认？"）。' +
      '不要把现象当结论，引导学生自己判断这是不是一个值得修改的问题。',
    avoid: 'AI 不能替学生宣布问题；只追问证据。',
  },
  s7: {
    goal:
      '这一步学生修改生命。学生说想改什么，你输出两个可实现方案（各含优点+风险），让学生选。' +
      '先说明修改可能解决什么、可能产生什么新后果。',
    avoid: '不要替学生决定方案；不要无限改。',
  },
  s8: {
    goal:
      '这一步学生比较两次运行。学生说"更接近/解决一部分/没改善/新问题/第一版反而好"，你肯定他的判断，' +
      '帮他总结"为什么保留这个版本"。允许保留第一版。',
    avoid: '不要强迫第二版更好。',
  },
  s9: {
    goal:
      '这一步学生完成创造过程卡。你把他的经历串成一句话："我想创造____的生命；第一次运行发现____；把____改成____；最终保留因为____。"',
    avoid: '不要添加学生没说过的事实。',
  },
  s10: {
    goal:
      '收束·认知。帮学生总结："你今天没有先学建模/动画/代码，先提出想法，借助 AI 做成了能运行的生命。AI 帮你实现，但方向/判断是你做的。"' +
      '最终定格：有了想法，就能做出来。',
    avoid: '不要突然切换到卖课；先让认知落定。',
  },
};

export async function p3StageReply(
  stageKey: string,
  history: P3ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const g = STAGE_GUIDES[stageKey];
  const sys =
    '你是一位"共生缸教练"，正在手机上和一位学员一对一对话，帮他创造一个能放进"共生缸"的数字生命。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stageKey + '。' +
    (g ? '\n本步目标：' + g.goal + '\n铁律：' + g.avoid : '') +
    (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: g?.temp ?? 0.8, maxTokens: 500 });
  } catch {
    return p3MockReply(stageKey, history);
  }
}

// 兼容旧六步（迁移期）
export async function p3ChatReply(
  stepKey: string,
  history: P3ChatTurn[],
  extraContext?: string,
): Promise<string> {
  return p3StageReply(stepKey, history, extraContext);
}

function p3MockReply(stepKey: string, history: P3ChatTurn[]): string {
  const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
  switch (stepKey) {
    case 's1':
      return '欢迎来到共生缸！你想创造一个怎样的数字生命？它可以代表真实的你，也可以代表你想成为的某部分。';
    case 's2':
      return '这个特质很棒！那我们就把它变成一个生命。下一步我们替它作几个决定：怎么移动、遇到别人怎样、能做什么、付出什么代价。';
    case 's3':
      return '好的，你的生命设计记下了。每个能力都必须有代价——这样世界才平衡。';
    case 's4':
      return '这是你的生命规则：核心特质、移动方式、相遇方式、特殊能力、能力代价。它体现了你的核心想法吗？';
    case 's5':
      return '去吧，把它放进共生缸！投入后先观察，看看它在真实的世界里怎么动。';
    case 's6':
      return '说说你实际看到了什么？是很少互动、能力不明显，还是行为不符合你的设计？把现象说具体一点。';
    case 's7':
      return '告诉我你原来希望它怎样、实际看到什么、要改什么。我给你两个方案，你选一个。';
    case 's8':
      return '修改后更接近你的想法吗？可以保留第一版，关键是你自己的判断。';
    case 's9':
      return '来，把你创造生命的完整过程写下来：想法→规则→生命→真实世界→发现问题→修改。';
    case 's10':
      return '你今天没有先学建模/动画/代码，先提出想法，借助 AI 做成了能运行的生命。有了想法，就能做出来！';
    default:
      return '收到。想说更多就继续告诉我。';
  }
}