export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';
import { readLives, readState } from '@/lib/world/store';

// AI 只做两件事：
// 1. explain：解释学生生命当前行为原因（基于引擎真实 reason + 能量/关系数据）
// 2. suggest：把学生的一句话想法转成三个倾向值 + 一句修改建议
// AI 不可用时规则回退；AI 不自动提交。

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const anonymousId = String(body.anonymousId || '');
  const message = String(body.message || '').trim();
  const mode = String(body.mode || 'explain');

  if (!anonymousId || !message) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
  }

  const livesData = readLives();
  const my = livesData.lives.find((l) => l.sid === anonymousId);
  const state = readState();
  const myState = state?.lives.find((l) => l.id === `life-${anonymousId}`);

  if (mode === 'suggest') {
    const reply = await suggestTraits(message, my?.name ?? '它');
    return NextResponse.json(reply);
  }

  // explain
  const reply = await explainBehavior(message, my, myState);
  return NextResponse.json({ reply });
}

async function suggestTraits(
  message: string,
  name: string,
): Promise<{ reply: string; suggestion?: { social: number; helpful: number; cautious: number } }> {
  const sys = '你是《我的世界》里帮助学生设计数字生命的助手。学生用一句话描述他希望生命怎么表现。你只做两件事：1）把这句话转成三个 0-1 的倾向值（亲近 social / 帮助 helpful / 谨慎 cautious）；2）给一句不超过 30 字的修改建议。必须只返回 JSON：{"social":0-1,"helpful":0-1,"cautious":0-1,"advice":"一句建议"}，不要其他文字。';
  const user = `生命名字：${name}\n学生的想法：${message}\n请输出三个倾向值和一句建议。`;

  try {
    const text = await chatWithLLM([{ role: 'user', content: user }], sys, { json: true, maxTokens: 200, timeoutMs: 15000 });
    const p = extractJson(text);
    const social = clamp01(Number(p?.social));
    const helpful = clamp01(Number(p?.helpful));
    const cautious = clamp01(Number(p?.cautious));
    const advice = String(p?.advice ?? '').trim();
    return {
      reply: `已生成候选：亲近 ${Math.round(social * 100)} · 帮助 ${Math.round(helpful * 100)} · 谨慎 ${Math.round(cautious * 100)}${advice ? `\n建议：${advice}` : ''}（点「提交」确认后生效）`,
      suggestion: { social, helpful, cautious },
    };
  } catch {
    // 规则回退：按关键词粗判
    const s = ruleSuggest(message);
    return {
      reply: `已生成候选（基础模式）：亲近 ${Math.round(s.social * 100)} · 帮助 ${Math.round(s.helpful * 100)} · 谨慎 ${Math.round(s.cautious * 100)}\n建议：${s.advice}（点「提交」确认后生效）`,
      suggestion: s,
    };
  }
}

async function explainBehavior(
  _message: string,
  my: { name: string; versions: { social: number; helpful: number; cautious: number }[] } | undefined,
  myState: { name: string; energy: number; state: string; action: string; reason: string; social: number; helpful: number; cautious: number } | undefined,
): Promise<string> {
  if (!myState) {
    return '你的生命还没有进入世界。先去创建它，等老师发布后就能看到它了。';
  }
  const sys = '你是《我的世界》里帮学生理解自己数字生命行为原因的助手。你必须只基于提供的真实数据解释，不能编造。用 1-2 句话、平等的语气回答。';
  const data = `生命：${myState.name}\n当前能量：${Math.round(myState.energy)}\n状态：${myState.state === 'active' ? '活动' : '休眠'}\n当前行为：${myState.action}\n引擎记录的原因：${myState.reason}\n倾向：亲近 ${Math.round(myState.social * 100)} · 帮助 ${Math.round(myState.helpful * 100)} · 谨慎 ${Math.round(myState.cautious * 100)}`;
  const user = `学生问：${_message}\n\n以下是引擎记录的真实数据：\n${data}\n\n请解释原因，并在合适时建议修改哪个倾向。`;

  try {
    const text = await chatWithLLM([{ role: 'user', content: user }], sys, { maxTokens: 200, timeoutMs: 15000 });
    return text;
  } catch {
    return `当前行为：${myState.reason}。它现在能量 ${Math.round(myState.energy)}。${
      myState.energy < 30 ? '能量偏低时它会优先找资源；如果它频繁休眠，可以试试降低谨慎倾向。' : ''
    }`;
  }
}

function extractJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

function ruleSuggest(message: string): { social: number; helpful: number; cautious: number; advice: string } {
  let social = 0.5;
  let helpful = 0.5;
  let cautious = 0.5;
  if (/帮助|照顾|保护|善良|帮别人/.test(message)) helpful = 0.8;
  if (/别.*耗尽|不要.*累|保护自己|留一点/.test(message)) cautious = 0.7;
  if (/朋友|热闹|一起|社交|合群/.test(message)) social = 0.7;
  if (/独自|安静|独处|不.*挤/.test(message)) { social = 0.3; cautious = 0.7; }
  const advice = helpful >= 0.7 && cautious < 0.6 ? '提高谨慎倾向，帮助别人的同时保护自己。' : '调整倾向后提交，下一轮看变化。';
  return { social, helpful, cautious, advice };
}
