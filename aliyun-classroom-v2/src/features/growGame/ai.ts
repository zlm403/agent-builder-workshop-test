// =========================================================
// 方案三 · 养成游戏 · AI 层（LLM 驱动）
// 未配置 API Key 时代码走内置 mock，保证整套流程可离线演示。
// =========================================================
import { chatWithLLM } from '@/lib/llm';
import type { ChatMessage } from '@/lib/llm';
import type { P3ChatTurn } from './store';
import { P3_SUCCESS_CRITERIA } from './config';

type Role = 'user' | 'assistant';

function asRole(t: P3ChatTurn): Role {
  return t.role === 'user' ? 'user' : 'assistant';
}

function buildHistory(history: P3ChatTurn[]): ChatMessage[] {
  return history.map((h) => ({ role: asRole(h), content: h.content }));
}

// 对话通用入口（步1/2/4/5 的引导式对话）
export async function p3ChatReply(
  stepKey: string,
  history: P3ChatTurn[],
  extraContext?: string,
): Promise<string> {
  const sys =
    '你是一位"游戏设计教练"，正在手机上和一位学员一对一对话，帮他设计一款手机端养成游戏。' +
    '你说话自然、口语化、有温度，一次只问一个明确的问题。避免长篇大论，避免空洞鼓励。' +
    '当前阶段：' + stepKey + '。' + (extraContext ? '\n背景：' + extraContext : '') +
    '\n请根据学生最近的回答，给出下一步引导。一定要推动对话往前走，不要重复已经问过的问题。';
  const messages = [...buildHistory(history)];
  try {
    return await chatWithLLM(messages, sys, { temperature: 0.8, maxTokens: 500 });
  } catch {
    return p3MockReply(stepKey, history);
  }
}

// 建立规则（步3）：多轮问答，返回是否已收集足够信息
export interface P3BuildResult {
  done: boolean;
  reply?: string;
}

const RULES_MARKERS = ['属性', '冲突', '选择', '消耗'];

export async function p3RulesReply(history: P3ChatTurn[], userText: string): Promise<P3BuildResult> {
  const userMsgs = history.filter((h) => h.role === 'user').map((h) => h.content).join(' ');
  const covered = RULES_MARKERS.filter((m) => userMsgs.includes(m)).length;

  const sys =
    '你是"游戏设计教练"，正在通过多轮问答，帮学员为一款养成游戏建立"核心规则"。' +
    '规则要覆盖四块：' + RULES_MARKERS.join('、') + '。' +
    '学生的回答已覆盖 ' + covered + ' 块。据此决定：不足4块就继续问下一个最关键的缺失块（简短口语化），' +
    '已覆盖4块就结束，回复以【完成】开头（例如：【完成】太好了，规则已经能跑起来了！）。';

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
    if (n >= RULES_MARKERS.length) {
      return { done: true, reply: '太好了，规则已经能跑起来了！' };
    }
    const questions = [
      '先定 2-3 个核心属性：体力 / 心情 / 才华 / 羁绊 / 存款 / 名声…你选哪几个？',
      '再定属性关系：有没有"此消彼长"的冲突？（比如：加班赚了钱，却损耗心情）',
      '玩家通过什么"选择"提升或消耗这些属性？举个例子。',
      '每个选择会让哪几个属性发生变化？说具体一点。',
    ];
    return { done: false, reply: questions[Math.min(n, questions.length - 1)] };
  }
}

// 生成游戏第一版（步6）
export async function generateP3Game(rec: {
  objectName: string;
  growthDef: string;
  coreRules: string;
  events: string;
  endings: string;
}): Promise<{ code: string }> {
  const sys =
    '你是一个擅长做手机端"养成游戏"的独立游戏开发者，尤其擅长把玩家的选择变成有后果、有走向的玩法。' +
    '请生成完整 HTML 代码（单文件，内联 CSS/JS，中文界面，适合手机竖屏，一局 3-5 分钟）。' +
    '要求：①开局定义养成对象和 2-3 个核心属性（数值从 50 起步）；②依次抛出 3-5 个事件，每个事件给出 2-3 个选项，选项会增减属性并显示后果；③全部事件走完后，根据最终属性组合给出一个结局（至少 2 个不同结局）；④游戏过程显示属性条和当前进度。';
  const context =
    '养成对象：' + (rec.objectName || '（待定）') +
    '\n成长定义：' + (rec.growthDef || '（待定）') +
    '\n核心规则与冲突：' + (rec.coreRules || '（待定）') +
    '\n成长事件：' + (rec.events || '（待定）') +
    '\n结局设计：' + (rec.endings || '（待定）');
  try {
    const raw = await chatWithLLM([{ role: 'user', content: context }], sys, { temperature: 0.7, maxTokens: 2500 });
    const code = raw.includes('<html') || raw.includes('<!DOCTYPE') ? raw : wrapHtml(raw);
    return { code };
  } catch {
    return { code: mockGame(rec) };
  }
}

function wrapHtml(text: string): string {
  return '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>养成游戏</title><style>body{font-family:sans-serif;padding:16px;line-height:1.7}code{white-space:pre-wrap;background:#f1f5f9;padding:8px;display:block}</style></head><body><h2>养成游戏（初稿）</h2><pre>' + text.replace(/</g, '&lt;') + '</pre></body></html>';
}

function mockGame(rec: { objectName: string; coreRules: string; endings: string }): string {
  const obj = rec.objectName || '你的养成对象';
  const attrs = (rec.coreRules || '体力、心情').split(/[、，,\s]+/).slice(0, 3);
  const ending = (rec.endings || '不同选择通向不同结局').split(/\n/)[0];
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${obj} · 养成</title><style>body{font-family:sans-serif;margin:0;background:#0f172a;color:#f1f5f9;padding:24px 18px}section{margin-bottom:24px}h1,h2{font-size:20px}.bar{background:#334155;border-radius:999px;height:14px;margin:6px 0 14px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa)}button{display:block;width:100%;padding:14px;margin-top:10px;border-radius:10px;border:none;background:#1e293b;color:#e2e8f0;font-size:15px;text-align:left}button:hover{background:#334155}.end{font-size:18px;font-weight:700;color:#fde047}</style></head><body>
<script>
var attrs={${attrs.map(a=>`"${a}":50`).join(',')}};
var step=0;
var events=[
{q:"它面临第一个选择：往热闹处去，还是往安静处去？",o:[["选择热闹",{"${attrs[0]||'体力'}:10}],["选择安静",{"${attrs[1]||'心情'}:10}]]},
{q:"它获得了一次成长机会，代价是要付出一点什么。",o:[["付出一点"${attrs[0]||'体力'}",{"${attrs[1]||'心情'}:10,"${attrs[0]||'体力'}":-10}],["谨慎保守",{"${attrs[0]||'体力'}:5}]]},
{q:"一次两难的选择：朋友需要它，计划也需要它。",o:[["陪朋友",{"${attrs[1]||'心情'}:10,"${attrs[0]||'体力'}":-5}],["完成计划",{"${attrs[0]||'体力'}:10,"${attrs[1]||'心情'}":-5}]]}
];
function render(){var t=events[step];var h='<h1>${obj} · 成长之路</h1>';
for(var k in attrs){var v=Math.max(0,Math.min(100,attrs[k]));h+='<div>'+k+' <span id="'+k+'">'+v+'</span></div><div class="bar"><div class="fill" style="width:'+v+'%"></div></div>';}
if(step<events.length){h+='<section><p>'+t.q+'</p>';t.o.forEach(function(o,i){h+='<button onclick="pick('+i+')">'+o[0]+'</button>';});h+='</section>';}
else{var sum=0;for(var k in attrs)sum+=attrs[k];var good=sum>attrsMax();h+='<p class="end">'+(good?'${ending} · 心之所向':'${ending} · 疲惫但真实')+'</p>';}
document.body.innerHTML=h;}
function attrsMax(){var s=0;for(var k in attrs)s+=attrs[k];return s;}
function pick(i){var t=events[step];var d=t.o[i][1];for(var k in d)attrs[k]=(attrs[k]||50)+(d[k]||0);step++;render();}
render();
</script>
</body></html>`;
}

// 试玩检查（步6）
export async function p3JudgeWork(finalText: string): Promise<{ ok: boolean; note: string }> {
  const sys =
    '你是养成游戏质量评审。判断这款游戏是否达到"可发布"标准，标准如下：\n' +
    P3_SUCCESS_CRITERIA.map((c, i) => `${i + 1}. ${c}`).join('\n') + '\n' +
    '若达到标准回复：【通过】加一句肯定；若未达到，回复：【待改】再加一句具体、可执行的修改建议（只提最关键的一到两点）。';
  try {
    const reply = await chatWithLLM([{ role: 'user', content: '请评审这款养成游戏：\n' + finalText }], sys, { temperature: 0.5, maxTokens: 300 });
    const ok = reply.includes('【通过】');
    return { ok, note: reply.replace(/^【通过】|^【待改】/, '').trim() };
  } catch {
    return { ok: finalText.trim().length >= 30, note: finalText.trim().length >= 30 ? '选择有冲突、后果可见、结局与选择有关，可以发布。' : '再补一个两难事件：让玩家在选择之间真正做取舍。' };
  }
}

function p3MockReply(stepKey: string, history: P3ChatTurn[]): string {
  const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
  switch (stepKey) {
    case 'object':
      return '这是个很好的养成对象。为了把它变成游戏，请再说具体一点：它现在是什么状态？你想让玩家陪着它经历怎样的一段成长？';
    case 'growth':
      return '这个成长观很有味道。为了让规则落得下来，请告诉我：玩家的选择应该能改变它的哪 2-3 个方面？（比如：状态、关系、能力）';
    case 'events':
      return '这个事件很有冲突感。为了让它真的"有效"，再明确一下：每个选项分别会加哪个属性、减哪个属性？玩家能看到后果吗？';
    case 'endings':
      return '这个结局设计很有张力。为了让结局和选择挂钩，请告诉我：每个结局分别是由怎样的一组选择走到的？玩家会不会因为看不懂因果而觉得结局是随机的？';
    default:
      return '收到。想说更多就继续告诉我；想往前推进，就点下方对应的按钮。';
  }
}