// =========================================================
// 文字 → 三个内部倾向 的翻译层（AI 优先，规则回退）
// 学生的生命定义是"一段文字"，引擎内部用三个数值驱动行为。
// 这里把文字翻译成引擎能用的倾向值，并保留原文。
// =========================================================

import { chatWithLLM } from '@/lib/llm';

export interface TraitSuggest {
  social: number;
  helpful: number;
  cautious: number;
  advice: string; // 给学生的建议文案
}

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
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

// 规则回退：按关键词粗判三个倾向
export function ruleTraits(text: string): TraitSuggest {
  let social = 0.5;
  let helpful = 0.5;
  let cautious = 0.5;
  // 帮助
  if (/帮助|帮忙|帮它|帮人|帮别|照顾|保护别人|救助|分享|救/.test(text)) helpful = 0.8;
  if (/不帮|不帮助|不管|冷漠|只顾自己|不理/.test(text)) helpful = 0.2;
  // 谨慎 / 回避 / 保护自己
  if (/躲开|躲|避开|回避|远离|拥挤|太挤|谨慎|小心|警惕|保护自己|别.*耗尽|不.*累/.test(text)) cautious = 0.7;
  if (/莽撞|勇敢|冒险|冲动|激进|大胆|横冲/.test(text)) cautious = 0.25;
  // 亲近
  if (/交朋友|爱交|热闹|一起|社交|合群|亲近|靠近|黏|爱玩|群居/.test(text)) social = 0.7;
  if (/独处|独自|安静|孤僻|不理人|独来独往/.test(text)) social = 0.3;
  const advice = helpful >= 0.7 && cautious < 0.6 ? '它很愿意帮助别人，但记得留一点能量保护自己（生命定义里可以加"它会保护好自己"）。' : '可以再想一句话，让它的性格更鲜明。';
  return { social, helpful, cautious, advice };
}

const SYSTEM = '你是《我的世界》里帮助学生设计数字生命的助手。学生的生命定义是一段自然语言描述。你把它翻译成三个 0-1 的内部倾向值：亲近 social（越爱靠近别人越高）、帮助 helpful（越爱帮助别人越高）、谨慎 cautious（越谨慎回避越高）。只返回 JSON：{"social":0-1,"helpful":0-1,"cautious":0-1,"advice":"一句不超过30字的建议"}。不要输出其他文字。';

// AI 翻译，失败回退规则
export async function textToTraits(text: string): Promise<TraitSuggest> {
  try {
    const out = await chatWithLLM([{ role: 'user', content: text }], SYSTEM, { json: true, maxTokens: 200, timeoutMs: 15000 });
    const p = extractJson(out);
    if (!p) return ruleTraits(text);
    const social = clamp01(Number(p.social));
    const helpful = clamp01(Number(p.helpful));
    const cautious = clamp01(Number(p.cautious));
    return {
      social,
      helpful,
      cautious,
      advice: String(p.advice ?? '').trim() || '这条描述已经可以放进世界了。',
    };
  } catch {
    return ruleTraits(text);
  }
}
