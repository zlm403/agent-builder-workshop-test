// 终章（一人公司）核心运行逻辑：把学生搭的 4 个 Agent 串成一条协作链，
// 访客发一句话 → 依次调用 4 次 LLM（每个 Agent 用自己的「属性卡」当 system prompt）
// → 把每一步输出回传前端做可视化，并推送 realtime 事件给大屏。

import { prisma } from './db';
import { chatWithLLM } from './llm';
import { publish } from './realtime';
import type { FinaleAgent } from './finaleConfig';
import { SCENE_LABEL } from './finaleConfig';

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
    // 推送实时事件给大屏：当前公司的第 i 个 Agent 开始工作
    try {
      publish(company.sessionId, {
        type: 'finale:working',
        payload: { companyId, stepIndex: i, nickname: a.nickname || `员工${i + 1}`, role: a.role },
      });
    } catch {
      /* noop */
    }
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

    // 推送实时事件给大屏：当前哪个公司的哪个 Agent 正在工作
    try {
      publish(company.sessionId, {
        type: 'finale:step',
        payload: { companyId, stepIndex: i, nickname: a.nickname || `员工${i + 1}`, role: a.role },
      });
    } catch {
      /* noop */
    }
  }

  try {
    publish(company.sessionId, { type: 'finale:done', payload: { companyId } });
  } catch {
    /* noop */
  }

  const final = steps[steps.length - 1]?.output ?? '';
  return { steps, final, mock };
}
