// （一人公司）核心运行逻辑：
// 旧版：4 Agent 线性链（保留兼容）
// 新版：选公司 → 招 3 专家 → 发现重复 → 加前台 → GM 整顿 → 开业对话（前台分流→专家服务→出方案→收款）

import { prisma } from './db';
import { chatWithLLM } from './llm';
import { publish } from './realtime';
import type { FinaleAgent } from './finaleConfig';
import { SCENE_LABEL, COMPANIES, NAME_POOL } from './finaleConfig';

/* ========== 旧版：4 Agent 线性链（保留兼容） ========== */

export type FinaleStep = {
  role: string;
  nickname: string;
  input: string;
  output: string;
};

export type FinaleRunResult = {
  steps: FinaleStep[];
  final: string;
  mock: boolean;
};

function buildSystemPrompt(agent: FinaleAgent, scene: string, index: number, total: number): string {
  const isLast = index === total - 1;
  return `你是一个「一人公司」多 Agent 协同系统里的第 ${index + 1} 号员工。
【你的固定岗位】${agent.role}
【你的昵称】${agent.nickname || '员工' + (index + 1)}
【你的个性 / 说话风格】${agent.personality || '专业、简洁'}
【你的职责】${agent.duty || '完成本环节工作'}
【你的边界（绝对不能做的事）】${agent.boundary || '不跨界做别人的活'}
【你的规则（必须严格遵守）】${agent.rules || '无特殊规则'}
【你要交给下一环节的内容与格式】${agent.handoff || '把本环节成果清晰交代给下一员工'}
【公司类型】${SCENE_LABEL[scene] || scene}

协作纪律：
1. 只做你岗位职责内的事，绝不越界替别人干活。
2. 必须用自己的昵称和个性说话，让客户感受到你这个员工的性格。
3. 如果你写了规则，必须字字遵守（例如写了「禁止说可能/也许」，输出里一个都不要出现）。
4. 你的输出会被下一员工接收，所以请严格按「交接内容与格式」产出，方便下游直接用。
${isLast
    ? '5. 你是最后一环，你的输出就是最终交付给客户的完整成果，要结构清晰、可直接使用。'
    : '5. 你不是最后一环，产出后请简要说明「你交给了谁、交了什么」。'}
结尾请署名：「—— ${agent.nickname || '员工' + (index + 1)}」`;
}

function mockOutput(agent: FinaleAgent, visitorMsg: string, index: number, total: number): string {
  const nick = agent.nickname || '员工' + (index + 1);
  const role = agent.role;
  if (index === 0) {
    return `（${nick}·${role}）你好呀～我已记下你的需求：「${visitorMsg}」。\n正在把信息整理好，准备交给下一环节～\n—— ${nick}`;
  }
  if (index === total - 1) {
    return `（${nick}·${role}）这是为你整理好的完整交付稿（基于前面各环节的成果）：\n\n【${role}汇总】根据前面同事收集与诊断的信息，我们为你产出最终方案。\n（注：当前为离线演示稿，配置 DeepSeek Key 后将由你设定的员工真实协作生成。）\n\n—— ${nick}`;
  }
  return `（${nick}·${role}）我已完成本环节工作，正在把成果交接给下一位同事。\n（离线演示：你设定的「${role}」规则与职责会在此生效。）\n—— ${nick}`;
}

export async function runCompanyChain(
  companyId: string,
  visitorAnonymousId: string,
  visitorMsg: string
): Promise<FinaleRunResult> {
  const company = await prisma.agentCompany.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  const agents = (company.agents as FinaleAgent[]) ?? [];
  const steps: FinaleStep[] = [];
  let mock = false;
  let context = `【客户原始需求】${visitorMsg}`;

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const sys = buildSystemPrompt(a, company.scene, i, agents.length);
    const userMsg =
      i === 0
        ? `客户发来消息：「${visitorMsg}」\n请开始你的工作（接待客户、收集信息，并产出要交接的内容）。`
        : `当前协作上下文：\n${context}\n\n你是第 ${i + 1} 号员工（${a.role}）。请根据上下文完成你的职责，并产出要交给下一环节的内容。`;

    let output = '';
    try {
      publish(company.sessionId, {
        type: 'finale:working',
        payload: { companyId, stepIndex: i, nickname: a.nickname || `员工${i + 1}`, role: a.role },
      });
    } catch { /* noop */ }

    try {
      output = await chatWithLLM([{ role: 'user', content: userMsg }], sys);
    } catch {
      output = mockOutput(a, visitorMsg, i, agents.length);
      mock = true;
    }
    if (!output) {
      output = mockOutput(a, visitorMsg, i, agents.length);
      mock = true;
    }

    steps.push({ role: a.role, nickname: a.nickname || `员工${i + 1}`, input: i === 0 ? visitorMsg : context, output });
    context += `\n\n[${a.nickname || `员工${i + 1}`}（${a.role}）的输出]\n${output}`;

    try {
      publish(company.sessionId, {
        type: 'finale:step',
        payload: { companyId, stepIndex: i, nickname: a.nickname || `员工${i + 1}`, role: a.role },
      });
    } catch { /* noop */ }
  }

  try {
    publish(company.sessionId, { type: 'finale:done', payload: { companyId } });
  } catch { /* noop */ }

  const final = steps[steps.length - 1]?.output ?? '';
  return { steps, final, mock };
}

/* ========== 新版：组织进化流程 ========== */

/** 学生搭建状态 */
export interface A07StudentState {
  phase: 'company' | 'hire' | 'dup' | 'recep' | 'gm' | 'open' | 'share';
  companyKey: string | null;
  specialists: Array<{ role: string; skill: string; style: string; name: string }>;
  receptionist: { style: string; styleDesc: string; routes: string[]; name: string } | null;
  hireIdx: number;
  hireStage: 'role' | 'skill' | 'style';
  hirePick: { role: string; skill: string; style: string };
  // 对话状态
  chatMessages: Array<{ role: 'user' | 'recep' | 'spec'; name: string; text: string }>;
  chatPhase: 'recep' | 'spec' | 'done';
  chatRecepTurns: number;
  chatSpecTurns: number;
  chatSpec: { role: string; name: string } | null;
  chatFirstNeed: string;
  // 订单
  orderPrice: number;
  orderPriceStr: string;
  orderDone: boolean;
}

/** 大屏状态 */
export interface A07ScreenState {
  mode: 'brief' | 'dash';
  briefSlideIndex: number;
  totalStudents: number;
  typeCount: Record<string, number>;
  funnel: Record<string, number>;
  released: { dup: boolean; open: boolean };
  leaderboard: Array<{ bossName: string; companyName: string; revenue: number }>;
}

/**
 * 根据岗位+技能+风格生成专家员工卡（调用 LLM）
 * 返回完整的员工档案：name, personality, duty, boundary, rules, handoff
 */
export async function generateSpecialistCard(
  companyKey: string,
  role: string,
  skill: string,
  style: string,
): Promise<{
  name: string;
  personality: string;
  duty: string;
  boundary: string;
  rules: string;
  handoff: string;
}> {
  const company = COMPANIES[companyKey as keyof typeof COMPANIES];
  if (!company) throw new Error(`Unknown company key: ${companyKey}`);

  const prompt = `你是一个「${company.name}」的专业员工。请为以下配置生成完整员工档案：

【公司类型】${company.name}（${company.desc}）
【岗位】${role}
【王牌技能】${skill}
【工作风格】${style}

请用 JSON 格式返回以下字段（不要有多余文字）：
{
  "name": "给这个 AI 员工起一个中文名（2-3个字，亲切好记）",
  "personality": "一句话描述他的个性/说话风格",
  "duty": "详细描述他的核心职责（3-5句话）",
  "boundary": "他绝对不能做的事（2-3条）",
  "rules": "必须遵守的工作规则（2-3条）",
  "handoff": "他把工作交给下一环节时需要传递什么信息、用什么格式"
}`;

  try {
    const output = await chatWithLLM([{ role: 'user', content: prompt }]);
    // 尝试从 LLM 输出中解析 JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON in response');
  } catch {
    // 兜底：本地生成
    const nameIdx = Math.floor(Math.random() * NAME_POOL.length);
    return {
      name: NAME_POOL[nameIdx],
      personality: `${style}，擅长用${skill}帮助客户`,
      duty: `负责${role}相关工作，以${skill}为核心能力为客户提供专业服务`,
      boundary: `只处理${role}相关事务，不跨界做其他岗位的事`,
      rules: `保持${style}风格；每次回复都要体现专业度；遇到不确定的问题主动询问`,
      handoff: `把客户需求、已收集的信息和初步判断整理后交给下一环节`,
    };
  }
}

/**
 * 根据接待风格生成接待员卡片（调用 LLM）
 */
export async function generateReceptionistCard(
  companyKey: string,
  style: string,
  routes: string[],
): Promise<{
  name: string;
  personality: string;
  routingRules: string[];
  fallbackRule: string;
}> {
  const company = COMPANIES[companyKey as keyof typeof COMPANIES];
  if (!company) throw new Error(`Unknown company key: ${companyKey}`);

  const prompt = `你是一家「${company.name}」的统一接待员。请为以下配置生成完整档案：

【公司类型】${company.name}
【接待风格】${style}
【你认识的专家团队】${routes.join('、')}

请用 JSON 格式返回：
{
  "name": "接待员名字（2-3字）",
  "personality": "性格特点",
  "routingRules": ["每个专家对应的关键词或场景"],
  "fallbackRule": "当无法匹配任何专家时的兜底策略"
}`;

  try {
    const output = await chatWithLLM([{ role: 'user', content: prompt }]);
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON in response');
  } catch {
    return {
      name: '小迎',
      personality: `${style}风格，善于倾听和理解需求`,
      routingRules: routes.map((r) => `包含"${r.replace(/顾问|老师|师/g, '')}"关键词时转交给${r}`),
      fallbackRule: '无法匹配时转交给第一位专家',
    };
  }
}

/**
 * 接待员对话路由：分析用户输入，决定是继续聊天还是转交专家
 */
export async function runReceptionistChat(
  sessionId: string,
  companyId: string,
  receptionist: { style: string; routes: string[] },
  specialists: Array<{ role: string; skill: string; name: string }>,
  history: Array<{ role: string; text: string }>,
  userInput: string,
): Promise<{
  reply: string;
  shouldTransfer: boolean;
  targetSpec?: { role: string; name: string };
}> {
  const systemPrompt = `你是「${receptionist.style}」风格的统一接待员小迎。

你认识以下专业员工：${specialists.map((s) => `${s.name}（${s.role}，擅长${s.skill}）`).join('；')}

你的职责：
1. 用${receptionist.style}的方式跟客户聊天，了解需求
2. 当你足够了解客户需求后，把客户转交给最合适的专家
3. 转交条件：聊了至少 2 轮，且能从用户输入中匹配到某个专家的领域

转交格式："我觉得这个问题最适合我们的【专家名·岗位】，我帮你转接过去 👉"

当前对话历史：
${history.map((h) => `${h.role}: ${h.text}`).join('\n')}

客户最新消息：「${userInput}」`;

  try {
    const output = await chatWithLLM([{ role: 'user', content: systemPrompt }]);

    // 判断是否要转交
    let targetSpec: { role: string; name: string } | undefined;
    let shouldTransfer = false;

    for (const spec of specialists) {
      const keyword = spec.role.replace(/顾问|老师|师/g, '');
      if (output.includes(keyword) || output.includes(spec.name) || userInput.includes(keyword)) {
        targetSpec = { role: spec.role, name: spec.name };
        shouldTransfer = true;
        break;
      }
    }

    return { reply: output, shouldTransfer, targetSpec };
  } catch {
    // 兜底逻辑
    for (const spec of specialists) {
      const keyword = spec.role.replace(/顾问|老师|师/g, '');
      if (userInput.includes(keyword)) {
        return {
          reply: `好的，我看出来了！你这个需求最适合我们的【${spec.name}·${spec.role}】，我帮你转接过去 👉`,
          shouldTransfer: true,
          targetSpec: { role: spec.role, name: spec.name },
        };
      }
    }
    return {
      reply: `关于「${userInput}」，方便再说说具体场景吗？这样我好给你找对专家 😊`,
      shouldTransfer: false,
    };
  }
}

/**
 * 专家对话：提供专业服务，最终出方案
 */
export async function runSpecialistChat(
  specialist: { role: string; skill: string; style: string; name: string },
  companyKey: string,
  history: Array<{ role: string; text: string }>,
  userInput: string,
  isFirstContact: boolean,
): Promise<{
  reply: string;
  readyForProposal: boolean;
}> {
  const company = COMPANIES[companyKey as keyof typeof COMPANIES];
  const systemPrompt = `你是${company?.name || ''}的专业员工${specialist.name}（${specialist.role}）。

【王牌技能】${specialist.skill}
【工作风格】${specialist.style}

你的职责是用${specialist.skill}为客户解决问题。保持${specialist.style}的风格。

当前对话历史：
${history.map((h) => `${h.role}: ${h.text}`).join('\n')}

${isFirstContact ? `前台刚把客户需求转给你，客户最初说的是：「${history.find(h => h.role === 'user')?.text || userInput}」` : ''}
客户最新消息：「${userInput}」`;

  try {
    const output = await chatWithLLM([{ role: 'user', content: systemPrompt }]);
    // 简单判断是否可以出方案（聊够 2 轮以上）
    const readyForProposal = history.length >= 3;
    return { reply: output, readyForProposal };
  } catch {
    return {
      reply: `收到「${userInput}」。关于这个需求，我能用我的${specialist.skill}能力帮你解决。能再补充一些细节吗？`,
      readyForProposal: false,
    };
  }
}

/**
 * 专家生成方案/报价
 */
export async function generateProposal(
  specialist: { role: string; skill: string; name: string },
  companyKey: string,
  needDescription: string,
  chatHistory: Array<{ role: string; text: string }>,
): Promise<{
  items: Array<[string, string]>;
  price: number;
  priceStr: string;
  deliverables: string;
}> {
  const company = COMPANIES[companyKey as keyof typeof COMPANIES];

  const prompt = `你是${company?.name || ''}的专业员工${specialist.name}（${specialist.role}），王牌技能是${specialist.skill}。

客户需求：「${needDescription}」
对话记录：
${chatHistory.map((h) => `${h.role}: ${h.text}`).join('\n')}

请给出一个合理的方案和报价，用 JSON 格式返回：
{
  "items": [["项目名称", "描述"], ...],
  "price": 数字价格,
  "priceStr": "¥xxx（含说明）",
  "deliverables": "交付物描述"
}

注意：价格要合理（学习类 199-599，购物类 80-300，娱乐类 9.9-99）。`;

  try {
    const output = await chatWithLLM([{ role: 'user', content: prompt }]);
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON');
  } catch {
    // 兜底
    let price: number;
    let items: [string, string][];
    if (company?.name === 'AI好物店') {
      price = 80 + Math.floor(Math.random() * 220);
      items = [
        ['推荐方案', `${specialist.skill}：精选方案`],
        ['价格', `¥${price}`],
        ['时间安排', '尽快安排'],
        ['交付物', '实物礼物 + 手写贺卡'],
      ];
    } else if (company?.name === 'AI学习中心') {
      price = 199 + Math.floor(Math.random() * 400);
      items = [
        ['诊断', '先定位薄弱点'],
        ['方案', `${specialist.skill}：精讲服务`],
        ['价格', `¥${price}`],
        ['时间安排', '本周起每周固定时间'],
      ];
    } else {
      price = parseFloat((9.9 + Math.random() * 90).toFixed(1));
      items = [
        ['定制方案', `${specialist.skill}：游戏脚本`],
        ['价格', `¥${price}`],
        ['时间安排', '现在就能玩'],
        ['交付物', '游戏流程 + 规则 + 道具清单'],
      ];
    }
    return {
      items,
      price,
      priceStr: `¥${price}`,
      deliverables: items.find((i) => i[0] === '交付物')?.[1] || '完整交付物',
    };
  }
}

/**
 * 推送大屏实时事件
 */
export function pushScreenEvent(sessionId: string, event: { type: string; payload: Record<string, unknown> }): void {
  try {
    publish(sessionId, event);
  } catch { /* noop */ }
}
