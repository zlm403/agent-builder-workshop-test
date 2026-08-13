// =========================================================
// 方案二 · 快速入门网站 · AI 层（LLM 驱动）
// 未配置 API Key 时代码走内置 mock，保证整套流程可离线演示。
// =========================================================
import { chatWithLLM } from '@/lib/llm';
import type { ChatMessage } from '@/lib/llm';
import type { P2ChatTurn } from './store';
import { P2_SUCCESS_CRITERIA } from './config';

type Role = 'user' | 'assistant';

function asRole(t: P2ChatTurn): Role {
  return t.role === 'user' ? 'user' : 'assistant';
}

function buildHistory(history: P2ChatTurn[]): ChatMessage[] {
  return history.map((h) => ({ role: asRole(h), content: h.content }));
}

// 对话通用入口（s1-s12 各阶段引导）
// 每阶段有明确的"要达成什么 / 铁律"，防止 AI 跑偏
const STAGE_GUIDES: Record<string, { goal: string; avoid: string; temp?: number }> = {
  s1: {
    temp: 0.3,
    goal:
      '你正在和一位学员对话，他要为"零基础的人"做一个陌生领域的入门网站。' +
      '你要做的：① 如果他说了想帮别人进入哪个领域，就用一句话热情地接住它（例："帮完全不懂的人快速入门咖啡，这个想法很好！"）；' +
      '② 如果他还没说，就自然地问一句"你想帮别人进入哪个领域？"；' +
      '③ 如果他问"怎么做"，你就说"没关系，我们一步一步来"。不要提"下一步"这类词，就像正常聊天。',
    avoid: '铁律：1. 不要复述/照抄本段文字。2. 不要在这个阶段展开领域知识。3. 学生说什么就接什么。4. 每句要短。',
  },
  s2: {
    temp: 0.3,
    goal:
      '这一步要帮学员把愿望变成一句明确的任务句。问三个问题，逐个来：①这个网站帮助谁？②他现在遇到什么困难？③看完网站后能做什么？' +
      '学生答完后，你帮他把三个答案拼成一句任务句："我要为____，做一个关于____的网站，帮助他____。" 然后问"这句可以吗？"。',
    avoid: '铁律：1. 不要复述/照抄本段。2. 一次只问一个问题。3. 不要展开领域内容。4. 每句要短。',
  },
  s3: {
    goal:
      '这一步：让 AI 为学员的领域列出"零基础者最先要解决的 5 个问题"，并说明优先顺序。' +
      '如果学员还没给任务，就先把他的任务句复述一句，然后请他确认，再去列问题。' +
      '列问题时用"1. 2. 3. 4. 5."编号，简短，每个问题说清"新手想知道什么"。',
    avoid: '不要一次问太多，不要展开长篇。列出 5 个问题后，提示学员"可以选 3 个最关键的"。',
  },
  s4: {
    goal:
      '这一步：学员从 5 个问题里选 3 个最关键的。你帮他把选中的 3 个问题整理清楚。' +
      '如果学员说"删除太专业的"，就删掉太靠后的、不是第一次行动必需的问题。' +
      '最后确认："这就是你的 3 个核心问题，对吗？"',
    avoid: '不要添加新问题，只做选择和删减。',
  },
  s5: {
    goal:
      '这一步：把 3 个问题分别写成"零基础者看得懂、能行动"的内容。' +
      '学员给出一个问题，你回答：一段简短说明 + 3 个具体步骤 + 1 个例子。' +
      '如果学员说"太长/不具体/看不懂/第一步不明"，就按他的反馈改短、改具体、换日常语言、让第一步更明确。',
    avoid: '不要堆知识，不要默认读者懂专业概念。内容要短、听得懂、有动作、有例子。',
  },
  s6: {
    goal:
      '这一步：帮学员选网站风格，然后生成网页。' +
      '学员说"列一些风格"，你就列出 4-6 种适合入门网站的风格（如：温暖手作/清爽极简/专业杂志/活泼插画…），每种一句话。' +
      '学员选风格后，你确认，然后引导他把内容和任务交给你生成网页。',
    avoid: '风格列表要简短；不要一次生成网页，等学员选好风格。',
  },
  s9: {
    goal:
      '这一步：学员把同伴测试的反馈转给你，请先判断具体问题，再修改网页。' +
      '学员给反馈后，你回应："我来判断一下这个反馈说的是哪个具体问题"，然后说明判断，再给出修改建议或直接改。' +
      '不要改动无关内容。',
    avoid: '不要无脑接受模糊评价；要先把"哪看不懂/哪步不会"变成具体问题。',
  },
  s10: {
    goal:
      '这一步：学员做一个很小的新变化（改主题/加FAQ/换读者/加行动清单），独立完成。' +
      '学员说想做什么，你只提供目标框架帮助（我要增加____；帮助____；完成标准____），让他自己组织，你帮他实现。',
    avoid: '不要替学员决定，不要给完整步骤；鼓励他自己走"目标→问题→提问→判断"。',
  },
};

export async function p2StageReply(
  stageKey: string,
  history: P2ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const g = STAGE_GUIDES[stageKey];
  const sys =
    '你是一位"领域入门教练"，正在手机上和一位学员一对一对话，帮他做一款"帮助别人快速进入一个领域"的手机网站。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论。' +
    '当前阶段：' + stageKey + '。' +
    (g ? '\n本步目标：' + g.goal + '\n铁律：' + g.avoid : '') +
    (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: g?.temp ?? 0.8, maxTokens: 500 });
  } catch {
    return p2MockReply(stageKey, history);
  }
}

// 建立知识骨架（步3）：多轮问答，返回是否已收集足够信息
export interface P2BuildResult {
  done: boolean;
  reply?: string;
}

const SKELETON_MARKERS = ['概念', '区别', '误区', '行动'];

export async function p2SkeletonReply(history: P2ChatTurn[], userText: string): Promise<P2BuildResult> {
  const userMsgs = history.filter((h) => h.role === 'user').map((h) => h.content).join(' ');
  const covered = SKELETON_MARKERS.filter((m) => userMsgs.includes(m)).length;

  const sys =
    '你是"领域入门教练"，正在通过多轮问答，帮学员为一个领域建立"最小知识骨架"。' +
    '骨架要覆盖四块：' + SKELETON_MARKERS.join('、') + '。' +
    '学生的回答已覆盖 ' + covered + ' 块。据此决定：不足4块就继续问下一个最关键的缺失块（简短口语化），' +
    '已覆盖4块就结束，回复以【完成】开头（例如：【完成】太好了，骨架已经搭起来了！）。';

  const messages = buildHistory(history);
  messages.push({ role: 'user', content: userText });
  try {
    const reply = await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 400 });
    if (reply.startsWith('【完成】') || reply.includes('【完成】')) {
      return { done: true, reply: reply.replace(/^【完成】/, '').trim() };
    }
    return { done: false, reply };
  } catch {
    const n = covered;
    if (n >= SKELETON_MARKERS.length) {
      return { done: true, reply: '太好了，骨架已经搭起来了！' };
    }
    const questions = [
      '先说 3 个基本概念：在这个领域里，新手最先要认识哪几个词？',
      '再说 3 个关键区别：新手最容易搞混、但又决定判断的是哪几组？',
      '有哪些常见误区，是新手几乎都会犯的？',
      '最后：新手能完成的一次"第一次行动"是什么？',
    ];
    return { done: false, reply: questions[Math.min(n, questions.length - 1)] };
  }
}

// 生成网站第一版（s6 生成网页：用任务句 + 3 个核心问题 + 内容模块 + 风格）
export async function generateP2Site(rec: {
  goalTask: string;
  knowledgeQs: string;
  contentBlocks: string;
  style?: string;
}): Promise<{ code: string }> {
  const sys =
    '你是一个擅长做"新手入门网站"的网页设计师，尤其擅长把一个陌生领域讲得让人看得懂、做得出选择。' +
    '请为一个手机端快速入门网站生成完整 HTML 代码（单文件，内联 CSS/JS，中文界面，适合手机竖屏，5-7 分钟走完）。' +
    '页面视觉风格按学生选择的："' + (rec.style || '清爽极简') + '"。' +
    '结构要求：①开头一句话说清"这个网站帮谁、带你进入什么领域"；②依次展示 3 个核心问题对应的内容；③最后一步让读者能完成第一次选择/行动。' +
    '用对比卡片和简单交互代替长文章，手机上阅读舒服。';
  const context =
    '任务句：' + (rec.goalTask || '（待定）') +
    '\n3 个核心问题：' + (rec.knowledgeQs || '（待定）') +
    '\n内容模块：' + (rec.contentBlocks || '（待定）');
  try {
    let raw = await chatWithLLM([{ role: 'user', content: context }], sys, { temperature: 0.7, maxTokens: 2500 });
    // 去掉 markdown 代码块包裹（```html ... ```）
    raw = raw.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    // 只保留从 <html 或 <!DOCTYPE 开始的 HTML 部分（AI 常在前面加一段中文说明）
    const htmlStart = Math.min(
      raw.indexOf('<!DOCTYPE'),
      raw.indexOf('<html'),
    );
    const code = htmlStart >= 0 ? raw.slice(htmlStart) : raw;
    return { code: code.includes('<html') || code.includes('<!DOCTYPE') ? code : wrapHtml(code) };
  } catch {
    return { code: mockSite(rec) };
  }
}

function wrapHtml(text: string): string {
  return '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>快速入门</title><style>body{font-family:sans-serif;padding:16px;line-height:1.7}code{white-space:pre-wrap;background:#f1f5f9;padding:8px;display:block}</style></head><body><h2>快速入门网站（初稿）</h2><pre>' + text.replace(/</g, '&lt;') + '</pre></body></html>';
}

function mockSite(rec: { goalTask: string; knowledgeQs: string }): string {
  const goal = rec.goalTask || '带你快速进入这个领域';
  const qs = (rec.knowledgeQs || 'A vs B').split(/\n/).slice(0, 3);
  const q1 = qs[0] || '第一次需要准备什么？';
  const q2 = qs[1] || '用量放多少？';
  const q3 = qs[2] || '按什么步骤做？';
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>快速入门</title><style>body{font-family:sans-serif;margin:0;background:#f8fafc}section{padding:24px 18px;border-bottom:1px solid #e2e8f0}button{width:100%;padding:14px;margin-top:8px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:15px}button:focus{outline:2px solid #3b82f6}</style></head><body>
<section><h1>快速入门</h1><p>${goal}</p></section>
<section><h2>${q1}</h2><p>这里放第一段新手看得懂的内容。</p></section>
<section><h2>${q2}</h2><p>这里放第二段新手看得懂的内容。</p></section>
<section><h2>${q3}</h2><p>这里放第三段新手看得懂的内容。</p></section>
<section><h2>试一试</h2><button onclick="document.getElementById('r').innerText='你完成了第一次判断！'">开始第一次尝试</button><p id="r"></p></section>
</body></html>`;
}

// 小白测试判定（步6）
export async function p2JudgeWork(finalText: string): Promise<{ ok: boolean; note: string }> {
  const sys =
    '你是入门网站质量评审。判断这个入门网站是否达到"可发布"标准，标准如下：\n' +
    P2_SUCCESS_CRITERIA.map((c, i) => `${i + 1}. ${c}`).join('\n') + '\n' +
    '若达到标准回复：【通过】加一句肯定；若未达到，回复：【待改】再加一句具体、可执行的修改建议（只提最关键的一到两点）。';
  try {
    const reply = await chatWithLLM([{ role: 'user', content: '请评审这个入门网站：\n' + finalText }], sys, { temperature: 0.5, maxTokens: 300 });
    const ok = reply.includes('【通过】');
    return { ok, note: reply.replace(/^【通过】|^【待改】/, '').trim() };
  } catch {
    return { ok: finalText.trim().length >= 30, note: finalText.trim().length >= 30 ? '能让新手看懂门道并作出选择，可以发布。' : '再补一个真实挑战：让用户自己做一次有依据的选择。' };
  }
}

function p2MockReply(stepKey: string, history: P2ChatTurn[]): string {
  const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
  switch (stepKey) {
    case 's1':
      return '听起来很有意思。那我们就一起把这个入门网站做出来，帮不懂的人快速进入这个领域。你想帮别人进入哪个领域？';
    case 's2':
      return '好，我们把它说具体。先告诉我：这个网站帮助谁？他遇到什么困难？看完网站能做什么？';
    case 's3':
      return '明白。针对你的领域，零基础者最先要解决的 5 个问题大概是：\n1. ...\n2. ...\n3. ...\n4. ...\n5. ...\n\n你可以从里面选 3 个最关键的。';
    case 's4':
      return '好，那你的 3 个核心问题就是这些。接下来我们把它写成新手看得懂的内容。';
    case 's5':
      return '好的，我来把这个问题写成新手看得懂的内容：一段简短说明 + 3 个具体步骤 + 1 个例子。';
    case 's6':
      return '好的，适合这个网站的风格有几种：温暖手作 / 清爽极简 / 专业杂志 / 活泼插画……你选一个，我就把内容和任务交给你生成网页。';
    case 's9':
      return '我来判断一下这个反馈说的是哪个具体问题，然后给出修改建议。';
    case 's10':
      return '好的，你自己想清楚要增加什么、帮助谁、完成标准是什么，我来帮你实现这个小变化。';
    default:
      return '收到。继续说，我帮你推进。';
  }
}