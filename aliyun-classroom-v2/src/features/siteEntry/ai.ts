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

// 对话通用入口（步1/2/4/5 的引导式对话）
export async function p2ChatReply(
  stepKey: string,
  history: P2ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const sys =
    '你是一位"领域入门教练"，正在手机上和一位学员一对一对话，帮他做一款"帮助别人快速进入一个领域"的手机网站。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stepKey + '。' + (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。一定要推动对话往前走，不要重复已经问过的问题。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 500 });
  } catch {
    return p2MockReply(stepKey, history);
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

// 生成网站第一版（步6）
export async function generateP2Site(rec: {
  field: string;
  entryTask: string;
  skeleton: string;
  keyDiff: string;
  sitePlan: string;
}): Promise<{ code: string }> {
  const sys =
    '你是一个擅长做"新手入门网站"的网页设计师，尤其擅长把一个陌生领域讲得让人看得懂、做得出选择。' +
    '请为一个手机端快速入门网站生成完整 HTML 代码（单文件，内联 CSS/JS，中文界面，适合手机竖屏，5-7 分钟走完）。' +
    '结构按五屏：①兴趣入口 ②新手误区 ③关键门道 ④真实挑战（让用户做一次选择并给反馈）⑤入场卡（汇总他的偏好与下一步）。' +
    '用对比卡片和选择交互代替长文章。';
  const context =
    '领域：' + (rec.field || '（待定）') +
    '\n目标用户与入场任务：' + (rec.entryTask || '（待定）') +
    '\n知识骨架：' + (rec.skeleton || '（待定）') +
    '\n关键区别与判断标准：' + (rec.keyDiff || '（待定）') +
    '\n五屏规划：' + (rec.sitePlan || '（待定）');
  try {
    const raw = await chatWithLLM([{ role: 'user', content: context }], sys, { temperature: 0.7, maxTokens: 2500 });
    const code = raw.includes('<html') || raw.includes('<!DOCTYPE') ? raw : wrapHtml(raw);
    return { code };
  } catch {
    return { code: mockSite(rec) };
  }
}

function wrapHtml(text: string): string {
  return '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>快速入门</title><style>body{font-family:sans-serif;padding:16px;line-height:1.7}code{white-space:pre-wrap;background:#f1f5f9;padding:8px;display:block}</style></head><body><h2>快速入门网站（初稿）</h2><pre>' + text.replace(/</g, '&lt;') + '</pre></body></html>';
}

function mockSite(rec: { field: string; entryTask: string; keyDiff: string }): string {
  const field = rec.field || '这个领域';
  const entry = rec.entryTask || '帮你完成第一次判断和选择';
  const diff = (rec.keyDiff || 'A vs B').split(/\n/).slice(0, 3).join('；');
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${field}入门</title><style>body{font-family:sans-serif;margin:0;background:#f8fafc}section{padding:24px 18px;border-bottom:1px solid #e2e8f0}button{width:100%;padding:14px;margin-top:8px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:15px}button:focus{outline:2px solid #3b82f6}</style></head><body>
<section><h1>${field} · 快速入门</h1><p>${entry}</p></section>
<section><h2>新手误区</h2><p>新手最容易误解的两件事，先把它放下。</p></section>
<section><h2>三个关键区别</h2><ul><li>${diff || 'A 与 B 的区别'}</li></ul></section>
<section><h2>做一次选择</h2><button onclick="document.getElementById('r').innerText='你完成了第一次判断！'">A</button><button onclick="document.getElementById('r').innerText='你完成了第一次判断！'">B</button><p id="r"></p></section>
<section><h2>我的入场卡</h2><p>你知道了看什么、怎么选、下一步做什么。</p></section>
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
    case 'field':
      return '听起来很有意思。那我们就聚焦这个领域——先把它说具体：你熟悉它到什么程度？你身边有"完全不懂"的朋友吗？他们的困惑一般是什么？';
    case 'entry':
      return '很好，入口已经变小了。为了让内容更聚焦，再补两个信息：这个"新人"最怕遇到什么？你希望他看完网站后，5 分钟内能做出的那个选择具体是什么？';
    case 'judge':
      return '这组区别很关键。为了帮新手真正作判断，告诉我：每组区别里，新手"以为对但其实是错"的常见误区是什么？我可以帮你补对比案例。';
    case 'design':
      return '五屏结构很合适。最后确认一点：你的"第4屏·真实挑战"里，给新手出的那道选择题具体是什么？（比如一份陌生菜单 / 一组选项）';
    default:
      return '收到。想说更多就继续告诉我；想往前推进，就点下方对应的按钮。';
  }
}