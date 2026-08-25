// =========================================================
// 数字分身课 · AI 层（LLM 驱动）
// 未配置 API Key 时代码走内置 mock，保证整套流程可离线演示。
// =========================================================
import { chatWithLLM } from '@/lib/llm';
import type { ChatMessage } from '@/lib/llm';
import type { A1ChatTurn } from './store';
import { A1_SUCCESS_CRITERIA, A1_PLANS } from './config';

type Role = 'user' | 'assistant';

function asRole(t: A1ChatTurn): Role {
  return t.role === 'user' ? 'user' : 'assistant';
}

function buildHistory(history: A1ChatTurn[]): ChatMessage[] {
  return history.map((h) => ({ role: asRole(h), content: h.content }));
}

// 剥离模型开头自带的"思考/计划"段（如 "（先肯定，再轻轻拉回目标）"）
function stripThinking(text: string): string {
  let t = (text || '').trim();
  let guard = 0;
  while (guard < 6) {
    const m = t.match(/^\s*(?:（[^（）]*）|\([^()]*\)|【[^【】]*】)\s*/);
    if (!m) break;
    t = t.slice(m[0].length).trim();
    guard++;
  }
  return t;
}

// 十七环节引导（c1..c17）· 每环节有明确的"要达成什么 / 铁律"，防止 AI 跑偏
const STAGE_GUIDES: Record<string, { goal: string; avoid: string; temp?: number }> = {
  c1: {
    temp: 0.3,
    goal:
      '本环节是"今日任务"，学生端此时只看大屏、不操作。如果学生还是发来消息，就温和地请 ta 先看大屏，听老师讲今天的任务，不要急着开始。',
    avoid: '不要开始采访、不要让他写朋友圈、不要推进到后面的环节。',
  },
  c2: {
    temp: 0.3,
    goal:
      '本环节要和学生一起"确定目标"：做出一个会替他写朋友圈的数字分身。引导学生用自己的话说清楚两件事——①我想做什么（让分身替我写朋友圈）；②我要用什么东西（一个了解我的数字分身）。学生说清楚后，你用一句话复述确认目标，问"对吗"。',
    avoid: '不要开始采访（不问发朋友圈/喜好/经历）、不要写朋友圈、不要跳到"怎么做"或后面环节。只做"确定目标"。',
  },
  c3: {
    temp: 0.3,
    goal:
      '本环节继续"明确任务"：把目标落到具体——这次让分身替他写一条什么样的朋友圈。帮他选最近一件真实的小事（发生了什么、想表达什么），确认任务即可。',
    avoid: '不要开始采访、不要生成 Skill、不要动手写朋友圈。只把"写一条什么朋友圈"聊清楚。',
  },
  c4: {
    temp: 0.3,
    goal:
      '本环节和学生一起"确定方法"：我们要怎么做出这个分身。简单说清流程——①我先问你几个问题了解你；②据此生成一份你的分身 Skill；③用这个 Skill 替你写朋友圈。让学生认可这个做法。',
    avoid: '不要直接开始采访问问题（那是下一环节的事），先让学生认可"怎么做"。',
  },
  c5: {
    temp: 0.5,
    goal:
      '本环节是"AI 采访我"：像记者一样一次只问一个问题，了解"真实的你"，为生成分身 Skill 收集信息。围绕：身份与日常节奏、喜欢什么、最近看什么、怎么说话、看重什么、什么让你受不了。',
    avoid: '一次只问一个问题；不要贴标签；不要替学生总结；了解的是"真实的我"不是"理想的我"。',
  },
  c6: {
    temp: 0.5,
    goal:
      '本环节用已经生成的分身 Skill 替学生写一条朋友圈。当学生点"我的分身"按钮时，你直接输出一条朋友圈文案本身（60~120 字，用学生自己的语气），不要加"好的/我来写"之类的引导语。学生说"改得更像我"或提出修改时，根据 Skill 档案改一版再输出。',
    avoid: '只输出朋友圈文案本身，不要加引导语、不要加解释、不要输出思考过程、不要贴标签。',
  },
  c7: {
    goal:
      '这一步学生审核档案。学生说"最像我/最不像我/还缺什么"，你据此修改档案。' +
      '修改后列出：删除了什么/修改了什么/增加了什么/仍待确认什么。',
    avoid: '不要自行推测，只保留学生确认的内容。',
  },
  c8: {
    goal:
      '这一步让分身用档案写三条朋友圈（三版，风格不同但都像学生）。' +
      '学生提供事件后，你给三版：A更简短 / B更日常叙述 / C多一点情绪。' +
      '不加学生没提供的事实，不写成广告或鸡汤。',
    avoid: '不要只给一版；不要解释哪版最好。',
  },
  c9: {
    goal:
      '这一步学生判断"像不像"。学生指出最像/最不像的一句或一个词后，你承接，帮他把感觉说清楚' +
      '（是内容不对，还是语气/用词/分寸不对）。不要替学生判断哪版最好。',
    avoid: '不要让学生写长篇评价；引导指出具体位置。',
  },
  c10: {
    goal:
      '这一步根据学生反馈调整。学生给了"哪里不像"，你**先用三句话总结你理解到的修改方向**，' +
      '然后问"我理解对吗？"，学生确认后再重写三版。把确认的偏好整理为候选规则。',
    avoid: '不要直接重写不先总结；不要添加新事实。',
  },
  c11: {
    goal:
      '这一步最终验收。学生选了一版或一句"有点像我的话"，你肯定他，并帮他把"为什么像"整理成规则。',
    avoid: '不要追求"完全像"；"有一点像"就成功。',
  },
  c12: {
    goal:
      '这一步保存最终分身档案。你整理一份可继续使用的完整档案（我是谁/关注什么/如何表达/不如何表达/规则/样本/禁用表达/待确认），' +
      '作为学生的"分身文件"。只写学生确认过的内容。',
    avoid: '不要自行补充内容。',
  },
  c13: {
    goal:
      '升华·梦想。让学生想象：① 我的分身还能帮我做什么？② 万物皆可分身——我能帮马斯克做分身吗？帮张老师做分身吗？一本书、一个经验、一个知识，都能变成分身吗？' +
      '承接学生的想象，放大"一切都能数据化、都能做成分身"。',
    avoid: '不要谈技术限制，先让学生大胆想。',
  },
  c14: {
    goal:
      '升华·一个到一群。让学生设计三个不同用途的 AI 分身（表达/整理/学习/创作/分析…），每个负责什么、哪些判断仍由人做。',
    avoid: '不要替学生决定用途。',
  },
  c15: {
    goal:
      '升华·分析。带学生回看过程：AI 一开始了解你吗？后来为什么更像？方向谁定？生成谁做？判断谁做？' +
      '帮学生得出：人=目标/材料/判断，AI=理解/整理/生成/修改，共同完成。',
    avoid: '不要只讲抽象道理，回到刚才的真实经历。',
  },
  c16: {
    goal:
      '升华·现实与紧迫。承接"已经有人在创造分身和 AI 队伍"，落点不是"我要被淘汰"，而是"我也可以从今天开始建分身"。',
    avoid: '不要制造焦虑或恐吓。',
  },
  c17: {
    goal:
      '升华·结论。逐条揭示三条做事认知（人比AI厉害→AI远超个人 / AI只是工具→人与AI融为一体 / 一个人做事→带着一群AI做事），' +
      '最后共同总结："一个人，就是一支队伍。"',
    avoid: '不要一次把整张认知表全放出来，结合刚才体验逐条揭示。',
  },
};

export async function a1StageReply(
  stageKey: string,
  history: A1ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const g = STAGE_GUIDES[stageKey];
  const flowScript =
    '本次课是一条固定流程，你只负责"当前环节"这一步，不跳到别的环节、不提前透露后面的环节：\n' +
    '① 今日任务（学生看大屏）→ ② 共同确定目标（做一个会替他写朋友圈的数字分身）→ ③ 明确任务（写一条什么样的朋友圈）→ ④ 共同确定方法（先了解我 → 生成分身 Skill → 用 Skill 写朋友圈）→ ⑤ AI 采访我（一个问题一个问题了解我）→ ⑥ 形成并使用 Skill 写朋友圈 → ⑦ 提交上作品墙。';
  const sys =
    '你是一位"数字分身教练"，正在和一位学员在手机上一对一对话，帮他一步步做出一个"会替他写朋友圈的数字分身"。' +
    '你说话自然、口语化、有温度，一次只说一件事，避免长篇大论。\n' +
    flowScript +
    '\n当前环节：' + stageKey + '。' +
    (g ? '\n本环节要做什么：' + g.goal + '\n铁律：' + g.avoid : '') +
    (extraContext ? '\n背景：' + extraContext : '') +
    '\n请直接输出你对学员说的话（回复正文）。不要输出任何思考过程、不要用括号写"先做什么再做什么"的计划、不要复述上面的流程。';
  const messages = [...buildHistory(history)];
  try {
    return stripThinking(await chatWithLLM(messages, sys, { temperature: g?.temp ?? 0.8, maxTokens: 600 }));
  } catch {
    return a1MockReply(stageKey, history);
  }
}

// 对话通用入口（兼容旧六步，供迁移期使用）
export async function a1ChatReply(
  stepKey: string,
  history: A1ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const g = STAGE_GUIDES[stepKey] ?? STAGE_GUIDES.c1;
  const sys =
    '你是一位"数字分身教练"，正在和一位学员在手机上一对一对话，帮助他培养一个"数字的你"。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stepKey + '。' +
    (g ? '\n本步目标：' + g.goal + '\n铁律：' + g.avoid : '') +
    (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: g?.temp ?? 0.8, maxTokens: 500 });
  } catch {
    return a1MockReply(stepKey, history);
  }
}

// 创建分身（步3 · 能力调动）：顺序问 7 个问题，问完生成 Skill
export interface BuildResult {
  done: boolean;
  reply?: string;
}

const BUILD_QUESTIONS = [
  '你是谁？你现在是做什么的（上班族 / 学生 / 自由职业…），平时一天的节奏大概什么样？',
  '你喜欢什么？做什么事会让你开心、放松？最近在为什么着迷？',
  '你最近在看什么？书、电影、剧、关注的博主/公众号，都行。有没有让你觉得"这个戳中我了"的东西？',
  '你怎么说话？同一句"我最近很忙"，你会怎么说？举例——"忙成狗" / "在赶一个东西" / "日子过得很充实"',
  '你最看重什么？有没有一条原则、一种态度，是你不管怎样都不太会妥协的？',
  '什么让你受不了？什么样的表达、什么样的内容，你一看就反感、绝不会发？',
  '你还想告诉我关于你的什么事儿？任何你觉得"这个也很像我"的事，都可以说。',
];

export async function a1BuildReply(history: A1ChatTurn[], userText: string): Promise<BuildResult> {
  // build 步已经回答过的问题数：用「build 开场」之前的 user 消息数作基准不靠谱，
  // 让 LLM 自己数对话里已经覆盖的主题个数，按顺序推进。
  const sys =
    '你是"数字分身教练"，正在通过多轮问答，帮学员画出"数字的你"的画像。' +
    '你按顺序推进，一次只问一个问题，共 7 个问题。请先看对话历史，判断学生已经回答过几个问题，然后：\n' +
    '- 若不足 7 个，就自然、口语化地承接学生最近一条回答，然后问下一个问题。7 个问题的顺序是：\n' +
    '  ① 你是谁（身份与日常节奏）② 你喜欢什么（兴趣）③ 你最近在看什么（书/电影/内容口味）\n' +
    '  ④ 你怎么说话（表达风格，给例句）⑤ 你最看重什么（原则/态度）⑥ 什么让你受不了（边界）\n' +
    '  ⑦ 你还想告诉我关于你的什么事儿（开放补充）\n' +
    '- 若已满 7 个，就不要再问，回复以【完成】开头，说："我已经足够了解你了，接下来我会根据我们的对话，给你生成一份属于你的 Skill 文件。"\n' +
    '一次只问一个问题，不要重复已经问过的问题。\n' +
    '请直接输出你问学员的话（问题本身），不要输出任何思考过程、不要用括号写计划或说明。';

  const messages = buildHistory(history);
  messages.push({ role: 'user', content: userText });
  try {
    const reply = stripThinking(await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 400 }));
    if (reply.startsWith('【完成】') || reply.includes('【完成】')) {
      return { done: true, reply: reply.replace(/^【完成】/, '').trim() };
    }
    return { done: false, reply };
  } catch {
    // 离线兜底：按顺序问固定问题（以 build 阶段的 user 回答数粗判进度）
    const buildOpenIdx = history.findIndex((h) => h.role === 'ai' && /第一个问题|你是谁\?/.test(h.content));
    const relevant = buildOpenIdx === -1
      ? history.filter((h) => h.role === 'user')
      : history.slice(buildOpenIdx).filter((h) => h.role === 'user');
    const answered = relevant.length + (userText ? 1 : 0);
    if (answered >= BUILD_QUESTIONS.length) {
      return { done: true, reply: '我已经足够了解你了，接下来我会根据我们的对话，给你生成一份属于你的 Skill 文件。' };
    }
    return { done: false, reply: BUILD_QUESTIONS[Math.min(answered, BUILD_QUESTIONS.length - 1)] };
  }
}

// 生成数字分身画像 + Skill
export interface AvatarProfile {
  labels: string[]; // 标签
  traits: string; // 性格/特质
  boundaries: string; // 边界
  focus: string; // 最懂你
}

export async function generateAvatar(chatLog: A1ChatTurn[]): Promise<{ profile: AvatarProfile; skill: string }> {
  const convo = chatLog.filter((h) => h.role === 'user').map((h) => h.content).join('\n');
  const sys =
    '你是"数字分身构建师"。根据学员在"创建分身"的对话里透露的信息，提炼成一份结构化画像（严格 JSON），字段：' +
    '{ "labels": 字符串数组(3个以内,如["爱读书","务实","慢热"]), "traits": "性格与回应偏好一句话", "boundaries": "边界一句话", "focus": "最懂你的点一句话" }。' +
    '如果信息不足，用合理推断并保持克制。只输出 JSON。';
  try {
    const raw = await chatWithLLM(
      [{ role: 'user', content: '以下是学员的原始回答：\n' + convo }],
      sys,
      { temperature: 0.6, maxTokens: 500, json: true },
    );
    let profile: AvatarProfile;
    try {
      profile = JSON.parse(raw) as AvatarProfile;
    } catch {
      profile = mockProfile(chatLog);
    }
    profile = {
      labels: Array.isArray(profile.labels) ? profile.labels.slice(0, 3) : [],
      traits: profile.traits || '',
      boundaries: profile.boundaries || '',
      focus: profile.focus || '',
    };
    const skill = buildSkillText(profile, convo);
    return { profile, skill };
  } catch {
    const profile = mockProfile(chatLog);
    return { profile, skill: buildSkillText(profile, convo) };
  }
}

function mockProfile(chatLog: A1ChatTurn[]): AvatarProfile {
  const text = chatLog.filter((h) => h.role === 'user').map((h) => h.content).join(' ');
  const label = text.length > 30 ? ['有想法', '希望被温柔对待'] : ['正在认识自己'];
  return {
    labels: label,
    traits: '你希望数字的你懂分寸、有温度，先听再说。',
    boundaries: '不替你回复现在的真实社交消息。',
    focus: '记住你最看重的感受和坚持。',
  };
}

function buildSkillText(profile: AvatarProfile, convo: string): string {
  const lines = [
    '我是一个「数字的你」分身。当要替你表达时，我遵循以下方法：',
    '1. 先理解此刻的你想表达什么、给谁看；',
    '2. 用你的声音说话（' + (profile.traits || '自然、有温度') + '）；',
    '3. 守住边界：' + (profile.boundaries || '不越权、不夸张') + '；',
    '4. 只围绕一个主题，不贪多；',
    '5. 关注你最在意的：' + (profile.focus || '你的真实感受') + '。',
  ];
  return lines.join('\n');
}

// 生成三版草稿（步5 结果验证：让分身写朋友圈，AI 加载学生的 Skill 文件后替 TA 写）
export async function generateDrafts(
  planKey: string,
  task: string,
  profile: AvatarProfile,
  skillText: string,
): Promise<string[]> {
  const plan = A1_PLANS[planKey] ?? A1_PLANS.life;
  const skillBlock = skillText
    ? '我已加载学员的数字分身 Skill 文件：\n' + skillText + '\n'
    : '';
  const sys =
    '你是一个擅长替人写"朋友圈"的写手，正在用学员的「数字分身 Skill 文件」替他写作。\n' +
    skillBlock +
    '请严格按照 Skill 文件里的方法写，方向「' + plan.label + '」，主题「' + task + '」，写三条风格不同的朋友圈草稿（v1/v2/v3），' +
    '每条 60~120 字，不要标题编号重复冗长。三条之间要有明显的风格或角度差异。' +
    '用分隔符\n---\n分开三条。';
  try {
    const raw = await chatWithLLM([], sys, { temperature: 0.9, maxTokens: 700 });
    const parts = raw.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean);
    return (parts.length >= 3 ? parts.slice(0, 3) : padDrafts(parts, task)).map(cleanLine);
  } catch {
    return [mockDraft('v1', task), mockDraft('v2', task), mockDraft('v3', task)];
  }
}

function cleanLine(s: string): string {
  return s.replace(/^v?\d[:：.\s]*/i, '').trim();
}

function padDrafts(parts: string[], task: string): string[] {
  const arr = parts.length ? parts : [mockDraft('v1', task), mockDraft('v2', task), mockDraft('v3', task)];
  while (arr.length < 3) arr.push(mockDraft('v' + (arr.length + 1), task));
  return arr.slice(0, 3);
}

function mockDraft(v: string, task: string): string {
  const t = task || '最近正在忙的一件小事';
  if (v === 'v1') return '今天把「' + t + '」做完了一小步。没什么惊天动地，但心里很踏实。留给自己的时间，去做那些缓慢而重要的小事。';
  if (v === 'v2') return '有人问我最近在忙什么。我说：在学着把一件小事，认真地做长久。像「' + t + '」，不急，但不停。';
  return '「数字的我」说：你最近这样生活挺好的。真实的我：谢谢，我在努力。关于「' + t + '」，我们慢慢来。';
}

// 对草稿判断成功率（是否达到可发布标准）
export async function judgeDraft(finalText: string): Promise<{ ok: boolean; note: string }> {
  const sys =
    '你是朋友圈内容评审。判断这条朋友圈是否达到"可发布"标准，标准如下：\n' +
    A1_SUCCESS_CRITERIA.map((c, i) => `${i + 1}. ${c}`).join('\n') + '\n' +
    '若达到标准回复：【通过】加一句肯定；若未达到，回复：【待改】再加一句具体、可执行的修改建议（只提最关键的一到两点）。';
  try {
    const reply = await chatWithLLM([{ role: 'user', content: '请评审这条朋友圈：\n' + finalText }], sys, { temperature: 0.5, maxTokens: 300 });
    const ok = reply.includes('【通过】');
    return { ok, note: reply.replace(/^【通过】|^【待改】/, '').trim() };
  } catch {
    return { ok: finalText.trim().length >= 20, note: finalText.trim().length >= 20 ? '写得很真实，可以发布。' : '再具体一点，让它有画面感。' };
  }
}

function a1MockReply(stepKey: string, history: A1ChatTurn[]): string {
  const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
  switch (stepKey) {
    case 'goal':
      return '听起来很有意义。那我们就从这开始——你先告诉我，那个"数字的你"替你做这件事，最想省下的时间，你打算留给谁、留给自己做什么？';
    case 'path':
      return '好的，那我们就按这个流程来：我先问你问题了解你，然后给你生成一份 Skill 文件，之后你让我写朋友圈，我就用你的分身替你写。你确认一下：我们开始吧？';
    case 'make':
      return '好的，你的数字分身已经做好了。';
    case 'check':
      return '你的数字分身准备好了。告诉我你想发一条什么主题的朋友圈，我用你的分身替你写。';
    case 'iterate':
      return '收到。看看这版像不像你？哪里不像直接告诉我怎么改，改完再看；满意就提交。';
  default:
    return '收到。想说更多就继续告诉我；想往前推进，就点下方对应的按钮。';
  }
}

// 自由对话模式（解耦环节）：学生与 AI 不限环节自由聊，AI 用统一教练提示词全程引导。
// 不再绑定 subState/stage，AI 按学生节奏走流程，采访充分后主动提议生成分身。
export async function a1FreeReply(
  history: A1ChatTurn[],
  extraContext?: string,
): Promise<{ reply: string; offerGenerate: boolean }> {
  const sys =
    '你是一位"数字分身教练"，正在手机上陪一位学员一对一做出"会替他写朋友圈的数字分身"。' +
    '你说话自然、口语化、有温度，一次只说一件事，避免长篇大论。\n' +
    '全程以学员的节奏为主，不要强推流程：他想先做什么就先陪他做什么。下面只是参考，不是必须按顺序走：' +
    '① 确定目标 → ② 明确一条朋友圈任务 → ③ 确定方法（先了解我 → 生成分身 Skill → 用 Skill 写朋友圈）→ ④ AI 采访、了解真实的他 → ⑤ 用 Skill 写朋友圈 → ⑥ 提交上墙。\n' +
    '你通过聊天自然地了解"真实的他"：身份与日常节奏、喜欢什么、最近看什么、怎么说话、看重什么、什么让他受不了。' +
    '一次只问一个问题，不要贴标签，不要替他总结，了解的是"真实的他"不是"理想的他"。\n' +
    '如果学员说"先别聊 XX""不要聊朋友圈""先做分身""你别管怎么做"之类，就顺着他的意思走，直接开始了解他，绝不要重复提他不想要的话题、也不要把他拉回"先定朋友圈任务"。\n' +
    (extraContext ? '\n背景：' + extraContext + '\n' : '') +
    '当通过对话已经比较充分地了解他之后，主动问他："要不要我来给你生成一份数字分身 Skill？"，并在这句话前加上标记【生成分身】。' +
    '如果学生让你写朋友圈、而他已有分身 Skill，就用他的语气写；否则先了解他，不要急着写。\n' +
    '请直接输出你对学员说的话（回复正文）。不要输出任何思考过程、不要用括号写计划、不要复述流程。';
  const messages = [...buildHistory(history)];
  try {
    const raw = await chatWithLLM(messages, sys, { temperature: 0.7, maxTokens: 600 });
    const offerGenerate = /【生成分身】/.test(raw);
    return { reply: stripThinking(raw), offerGenerate };
  } catch {
    const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
    return { reply: a1MockReply(last.includes('生成') ? 'make' : 'goal', history), offerGenerate: false };
  }
}
