export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';
import { readLives, readState } from '@/lib/world/store';
import { ruleTraits } from '@/lib/world/traits';

// AI 只做两件事（文字驱动，不调滑杆）：
// 1. mode=create：学生说想法 → AI 生成一段"生命定义文字"，学生确认后填入表单提交
// 2. mode=observe：学生把观察到的行为/困惑发给 AI → AI 基于引擎真实数据分析，并给下一步建议
// AI 不可用（无 key/失败）时规则回退；AI 不自动提交。

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const anonymousId = String(body.anonymousId || '');
  const message = String(body.message || '').trim();
  const mode = String(body.mode || 'observe');

  if (!message) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'message required' } }, { status: 400 });
  }

  if (mode === 'create') {
    return NextResponse.json(await createLifeText(message));
  }

  // observe：分析真实运行数据
  const reply = await observeAnalysis(anonymousId, message);
  return NextResponse.json({ reply });
}

async function createLifeText(message: string): Promise<{ reply: string; draft?: string }> {
  const sys =
    '你是《我的世界》里帮学生把想法变成生命的助手。学生用一句话描述他希望的生命。' +
    '你帮他写出一段「生命定义」，这段文字会直接用于让生命在世界里行动。' +
    '要求：用中文，2-4 句话，用「它」称呼生命，描述它的性格和它喜欢怎样行动（比如爱不爱靠近别人、爱不爱帮助别人、遇到拥挤/危险会怎样）。不要提"数值""倾向""参数"等字眼。' +
    '只输出这段「生命定义」本身，不要其他说明。';
  try {
    const text = await chatWithLLM([{ role: 'user', content: message }], sys, { maxTokens: 200, timeoutMs: 15000 });
    const clean = (text || '').trim();
    if (clean) {
      return {
        reply: '已经帮你想好了一段生命定义，可以直接填入下面的「生命定义」，也可以自己改：',
        draft: clean,
      };
    }
    return fallbackLifeText(message);
  } catch {
    return fallbackLifeText(message);
  }
}

function fallbackLifeText(message: string): { reply: string; draft: string } {
  const t = ruleTraits(message);
  const parts: string[] = [];
  if (t.social >= 0.7) parts.push('它喜欢热热闹闹，爱和其他生命靠近');
  else if (t.social <= 0.3) parts.push('它更喜欢安静，常常独来独往');
  else parts.push('它既不特别爱凑热闹，也不刻意躲开别人');
  if (t.helpful >= 0.7) parts.push('它很愿意帮助能量不足的朋友');
  if (t.cautious >= 0.7) parts.push('遇到太挤的地方它会谨慎地躲开');
  if (parts.length === 0) parts.push('它在世界里自由探索，看看会发生什么');
  const draft = parts.join('；') + '。';
  return {
    reply: '（基础模式）已经帮你想好了一段生命定义，可以直接填入下面的「生命定义」，也可以自己改：',
    draft,
  };
}

async function observeAnalysis(
  anonymousId: string,
  message: string,
): Promise<string> {
  const livesData = readLives();
  const my = livesData.lives.find((l) => l.sid === anonymousId);
  const state = readState();
  const myState = state?.lives.find((l) => l.id === `life-${anonymousId}`);
  const othersCount = state?.lives.filter((l) => l.id !== `life-${anonymousId}`).length ?? 0;

  if (!myState) {
    return '你的生命还没有进入世界。先去创建它，等老师发布后就能看到它了。';
  }

  const sys =
    '你是《我的世界》里帮学生理解自己数字生命行为原因的助手。你只能基于提供的真实引擎数据解释，不能编造。' +
    '用 1-3 句话回答学生的问题：说明它为什么这样动、这正常吗、下一步可以怎么改（改哪句话让它更符合学生的想法）。语气平等，不说教。';
  const data = [
    `生命：${myState.name}`,
    `当前能量：${Math.round(myState.energy)}`,
    `状态：${myState.state === 'active' ? '活动' : '休眠'}`,
    `当前行为：${myState.action}`,
    `引擎记录的原因：${myState.reason}`,
    `世界里的生命总数：${(state?.lives.length ?? 0)}（其他 ${othersCount} 个）`,
  ].join('\n');
  const user = `学生问：${message}\n\n以下是引擎记录的真实数据：\n${data}\n\n请解释原因，并建议怎么改生命定义。`;

  try {
    const text = await chatWithLLM([{ role: 'user', content: user }], sys, { maxTokens: 250, timeoutMs: 15000 });
    return (text || '').trim();
  } catch {
    return `当前行为：${myState.reason}。它现在能量 ${Math.round(myState.energy)}。${
      myState.energy < 30
        ? '能量偏低时它会优先找资源；如果它频繁休眠，可以试试在生命定义里加一句"它会保护好自己"。'
        : '目前它在世界里正常行动。如果想让它更活跃/更安静，改一下生命定义再提交新版本，下一轮就能看到变化。'
    }`;
  }
}
