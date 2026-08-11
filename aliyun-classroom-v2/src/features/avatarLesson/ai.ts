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

// 对话通用入口（步1/2/4/5/6 的引导式对话）
export async function a1ChatReply(
  stepKey: string,
  history: A1ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const sys =
    '你是一位"数字分身教练"，正在和一位学员在手机上一对一对话，帮助他培养一个"数字的你"。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stepKey + '。' + (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。一定要推动对话往前走，不要重复已经问过的问题。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 500 });
  } catch {
    return a1MockReply(stepKey, history);
  }
}

// 创建分身（步3）：多轮问答，返回是否已收集足够信息
export interface BuildResult {
  done: boolean;
  reply?: string;
}

const BUILD_QUESTIONS = [
  '你希望这个分身，是一个怎样的性格？（温和 / 犀利 / 幽默 / 沉稳…你挑，或自己说）',
  '它和你说话时，你更喜欢它直接给建议，还是先听你倾诉再回应？',
  '有什么话或边界，是你希望它一定不要越界的？（比如：不要替你回复工作消息）',
  '它应该最懂你的什么？（你最看重、最想让它记住的一点）',
];

const BUILD_MARKERS = ['性格', '回应方式', '边界', '最懂你'];

export async function a1BuildReply(history: A1ChatTurn[], userText: string): Promise<BuildResult> {
  const userMsgs = history.filter((h) => h.role === 'user').map((h) => h.content).join(' ');
  // 已收集的维度数（按提到的关键词粗判）
  const covered = BUILD_MARKERS.filter((m) => userMsgs.includes(m)).length;

  const sys =
    '你是"数字分身教练"，正在通过多轮问答，帮学员画出"数字的你"的画像。' +
    '你现在按顺序推进，一次只问一个问题，覆盖以下四个维度：' + BUILD_MARKERS.join('、') + '。' +
    '学生的回答已经覆盖的维度有：' + covered + '个。据此决定：已覆盖不足4个就继续问下一个最关键的缺失维度（简短口语化），' +
    '已覆盖4个就结束，回复以【完成】开头（例如：【完成】太好了，我已经足够了解你了！）。';

  const messages = buildHistory(history);
  messages.push({ role: 'user', content: userText });
  try {
    const reply = await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 400 });
    if (reply.startsWith('【完成】') || reply.includes('【完成】')) {
      return { done: true, reply: reply.replace(/^【完成】/, '').trim() };
    }
    return { done: false, reply };
  } catch {
    // 离线兜底：按已覆盖维度推进固定问题
    const n = covered;
    if (n >= BUILD_QUESTIONS.length) {
      return { done: true, reply: '太好了，我已经足够了解你了！' };
    }
    return { done: false, reply: BUILD_QUESTIONS[Math.min(n, BUILD_QUESTIONS.length - 1)] };
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

// 生成三版草稿（步6）
export async function generateDrafts(planKey: string, task: string, profile: AvatarProfile): Promise<string[]> {
  const plan = A1_PLANS[planKey] ?? A1_PLANS.life;
  const sys =
    '你是一个擅长替人写"朋友圈"的写手，尤其擅长以"数字分身"+"真实的我"的反差与共鸣来表达。' +
    '请按方向「' + plan.label + '」，围绕主题「' + task + '」，写三条风格不同的朋友圈草稿（v1/v2/v3），' +
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
    case 'dream':
      return '听起来很有意义。那我们就从这开始——你先告诉我，那个"数字的你"替你做这件事，最想省下的时间，你打算留给谁、留给自己做什么？';
    case 'path':
      return '很好，我们就走 B 这条路，从小事做起。那么想一下：你平时最常做、也最想"分身替你干"的那件小事，具体是什么？说具体一点，比如"替我把每周的读书笔记整理成一段话"。';
    case 'task':
      return '主题明确了。为了让分身写出的朋友圈更像你，告诉我：这条朋友圈，你希望它主要表达一种"心情"还是"观点"？再补一句：是你想对自己说的，还是想对某个人说的？';
    case 'plan':
      return '好选择。为了写得更贴合你，最后补一个信息：你希望这条朋友圈是"发给自己看的记录"，还是希望真的发出去被朋友看到？';
    default:
      return '收到。想说更多就继续告诉我；想往前推进，就点下方对应的按钮。';
  }
}
