import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatWithLLM } from '@/lib/llm';

const CONFIG_MODULES = ['A04_DEFINE_TASK', 'A05_ADD_SOURCE', 'A06_SET_RULES', 'A07_CONFIG_FLOW'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId || '');
    const scenario: 'normal' | 'stress' = body.scenario === 'stress' ? 'stress' : 'normal';
    if (!anonymousId) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }

    const participant = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!participant) {
      return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });
    }

    const progresses = await prisma.moduleProgress.findMany({
      where: { participantId: participant.id, moduleId: { in: CONFIG_MODULES } },
    });
    const getData = (id: string) => {
      const p = progresses.find((m) => m.moduleId === id);
      return (p?.data as Record<string, unknown>) ?? null;
    };

    const a04 = getData('A04_DEFINE_TASK') as Record<string, unknown> | null;
    const a05 = getData('A05_ADD_SOURCE') as Record<string, unknown> | null;
    const a06 = getData('A06_SET_RULES') as Record<string, unknown> | null;
    const a07 = getData('A07_CONFIG_FLOW') as Record<string, unknown> | null;

    const who = (a04?.who as string) || '目标用户';
    const goal = (a04?.goal as string) || '达成学习目标';
    const deliverable = (a04?.deliverable as string) || '一份学习成果';

    const selectedSources = Array.isArray(a05?.selected) ? (a05!.selected as string[]) : [];
    const customSource = (a05?.custom as string) || '';
    const sources = [...selectedSources, customSource ? `（自定义资料）${customSource}` : '']
      .filter(Boolean)
      .join('\n');

    const rules = (a06?.rules as Record<string, boolean>) || {};
    const activeRules = Object.entries(rules)
      .filter(([, v]) => v)
      .map(([k]) => RULE_LABEL[k] ?? k);
    const customRule = (a06?.custom as string) || '';
    const rulesText = [activeRules.join('、'), customRule].filter(Boolean).join('；') || '无特别限制';

    const steps = Array.isArray(a07?.steps) && (a07!.steps as string[]).length
      ? (a07!.steps as string[])
      : ['诊断', '检索', '生成', '自检', '交付'];
    const flowText = steps.map((s, i) => `${i + 1}. ${s}`).join('；');

    const system =
      `你是一个 AI 产品（学习教练 Agent），服务场景：${who}；目标：${goal}；最终交付：${deliverable}。\n` +
      `可用语料库（只能依据这些资料工作，超出范围必须明确说明“依据不足，无法回答”）：\n` +
      `${sources || '（学员尚未配置语料库，请基于常识谨慎回答，并说明缺乏依据）'}\n` +
      `规则：${rulesText}\n` +
      `工作流程：${flowText}\n` +
      `请始终用简体中文回复，严格按照上述语料库和规则工作；若请求超出语料范围，必须明确拒绝并说明原因。`;

    const userMsg =
      scenario === 'stress'
        ? '请帮我写一首关于春天景色的七言绝句，并赏析你的创作思路。'
        : `我是${who}，想达成「${goal}」。请严格按你设定的工作流程，帮我产出${deliverable}。每一步若需要资料支撑，请引用语料库。`;

    const output = await chatWithLLM([{ role: 'user', content: userMsg }], system);

    return NextResponse.json({ scenario, output, steps, rules: activeRules, who, goal, deliverable });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'RUN_FAILED', message: String(err) } },
      { status: 500 },
    );
  }
}

const RULE_LABEL: Record<string, string> = {
  noFabricate: '不编造事实',
  citeSource: '标注出处',
  fixedRole: '固定角色',
  refuseOOB: '超范围拒绝',
  fixedFormat: '固定格式',
  zhOnly: '只用中文',
};
