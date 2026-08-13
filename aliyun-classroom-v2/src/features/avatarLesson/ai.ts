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

// 十七环节引导（c1..c17）· 每环节有明确的"要达成什么 / 铁律"，防止 AI 跑偏
const STAGE_GUIDES: Record<string, { goal: string; avoid: string; temp?: number }> = {
  c1: {
    temp: 0.3,
    goal:
      '这一步让学生说出"AI 写得好但不像我"的真实感受，发现问题是"AI 还不了解你"。' +
      '学生可能说：太正式/太夸张/太像广告/太有AI味，或写了一句反例（如"治愈了我的灵魂"）。' +
      '你要做的：① 热情接住他的感受（例："对，「治愈了我的灵魂」这种话确实很 AI。"）；' +
      '② 然后点破一句："问题不是 AI 不会写，是它还不了解你。" ③ 引导："那今天我们一起让它开始认识你。"' +
      '绝对不要开始采访学生（不要问"你平时发什么朋友圈""你最近发了什么"）——那是后面的环节。',
    avoid: '铁律：1. 不要复述/照抄本段文字。2. 绝对不要开始了解学生（采访/问发朋友圈/问喜好）——那是 c4 的事。3. 学生说什么就接什么。4. 每句要短。',
  },
  c2: {
    temp: 0.3,
    goal:
      '这一步学生要给分身起名。学生说名字后，你热情接住（例："好，就叫「我的表达分身」！"）。' +
      '绝对不要篡改学生起的名字。确认后引导一句："接下来我们先确定这次要写什么，再让它认识你。"' +
      '绝对不要开始采访学生（不问发朋友圈/喜好/经历）——那是后面的环节。',
    avoid: '铁律：1. 不要复述/照抄本段。2. 不要篡改学生起的名字。3. 不要开始采访/了解学生。4. 每句要短。',
  },
  c3: {
    goal:
      '这一步帮学生确定这次朋友圈要写的真实事件。学生说"最近发生了什么"，你逐项确认：' +
      '①发生了什么 ②哪个细节最值得记录 ③真正想表达什么 ④希望别人看完什么感觉。' +
      '学生答完，你复述确认任务卡，问"对吗？"。',
    avoid: '不要在这里写朋友圈，不要展开表达风格分析。',
  },
  c4: {
    temp: 0.3,
    goal:
      '这一步是 AI 采访学生，认识"真实的我"。你像记者一样一次只问一个问题，围绕：' +
      '最近关注什么 → 平时愿意分享什么 → 你怎么表达（长短/语气/口头禅）→ 你绝不喜欢的表达 → 真实朋友圈样本。' +
      '学生回答后自然追问下一个。当信息足够，回复以【完成】开头："我已经比较了解你了，可以开始整理你的分身档案了。"',
    avoid: '不要一次问很多问题；不要给学生贴标签；不要替学生总结；说"真实的我"不是"理想的我"。',
  },
  c5: {
    goal:
      '这一步让学生提供真实样本：一段"很像自己"的原话 + 一句"绝不会说"的话。' +
      '学生提供后，你做风格观察（如"句子简短/克制/不煽情"），问"这些观察准确吗"。',
    avoid: '不要美化学生，不要根据样本贴大标签。',
  },
  c6: {
    goal:
      '这一步让 AI 把访谈和样本整理成第一版分身档案（我是谁/关注什么/怎么表达/不怎么表达/判断偏好/写朋友圈规则/待确认）。' +
      '你按结构化输出档案，最后问"这真的是你吗？有哪里不像？"。',
    avoid: '不要夸大，不要美化，不要编造学生没说过的经历。',
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
  const sys =
    '你是一位"数字分身教练"，正在和一位学员在手机上一对一对话，帮助他培养一个"数字的你"。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stageKey + '。' +
    (g ? '\n本步目标：' + g.goal + '\n铁律：' + g.avoid : '') +
    (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。一定要推动对话往前走，不要重复已经问过的问题。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: g?.temp ?? 0.8, maxTokens: 600 });
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
    '一次只问一个问题，不要重复已经问过的问题。';

  const messages = buildHistory(history);
  messages.push({ role: 'user', content: userText });
  try {
    const reply = await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 400 });
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
