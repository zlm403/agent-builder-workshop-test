// =========================================================
// 《我的世界》行为解释器（Behavior v1）
// 把学生六块设计（创造/交流/反应/资源/潮流/成长）翻译成大屏决策核能消费的
// "行为说明书"（behavior）。消费端见 public/a3/bigscreen.html 的 runBehavior：
//   body { senseRadius, personalSpace, speedMul, dwellSec, reactionDelaySec, temperSec }
//   seek { people, resources, events }  —— 游荡时对不同实体的趋近权重
//   rules[{ when, do, priority }]        —— when∈快照键, do∈动作白名单
// AI 走 chatWithLLM；失败/非法一律规则回退 ruleBehavior，绝不中断提交。
// =========================================================

import { chatWithLLM } from '@/lib/llm';

export const WHEN_CONDITIONS = [
  'dangerNear', 'hitBy', 'strangerNear', 'friendHurt', 'friendThreatened', 'newThingNear', 'crowded',
] as const;
export const DO_ACTIONS = [
  'flee', 'retreat', 'observe', 'approach', 'help', 'confront', 'gather',
] as const;
export type WhenCond = (typeof WHEN_CONDITIONS)[number];
export type DoAction = (typeof DO_ACTIONS)[number];

export interface BehaviorV1 {
  body: {
    senseRadius?: number;
    personalSpace?: number;
    speedMul?: number;
    dwellSec?: number;
    reactionDelaySec?: number;
    temperSec?: number;
  };
  seek: { people?: number; resources?: number; events?: number };
  rules: { when: string; do: string; priority?: number }[];
}

export function defaultBehavior(): BehaviorV1 {
  return { body: {}, seek: { people: 0, resources: 0, events: 0 }, rules: [] };
}

function clampN(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

// 规则回退：无 AI 时按六块关键词生成一份合理说明书（保证生命一定有行为，不白板）
export function ruleBehavior(six: Record<string, unknown>): BehaviorV1 {
  const b: BehaviorV1 = { body: {}, seek: { people: 0, resources: 0, events: 0 }, rules: [] };
  const pick = (...keys: string[]): string => {
    let s = '';
    for (const k of keys) {
      const v = six?.[k];
      s += typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v || '');
    }
    return s;
  };
  const social = pick('交流', 'social');
  const react = pick('反应', 'react');
  const trend = pick('潮流', 'trend');
  const resource = pick('资源', 'resource');

  if (/朋友|社交|陪伴|一起|帮/.test(social)) b.seek.people = 1.5;
  if (/资源|吃|收集|好奇|探索/.test(resource + trend)) b.seek.resources = 1.2;
  if (/浪|事件|热闹|看|围观/.test(trend)) b.seek.events = 1.0;

  if (/帮|照顾|救人|帮忙|贴心/.test(social)) b.rules.push({ when: 'friendHurt', do: 'help', priority: 8 });
  if (/聚|朋友|一起|护/.test(social)) b.rules.push({ when: 'friendThreatened', do: 'confront', priority: 9 });
  if (/怕|躲|谨慎|警惕|害羞|怕生/.test(react + trend)) b.rules.push({ when: 'strangerNear', do: 'flee', priority: 5 });
  if (/反击|凶|脾气|打回去|硬|不服/.test(react)) b.rules.push({ when: 'hitBy', do: 'confront', priority: 7 });
  if (/好奇|凑近|看|观察|研究/.test(trend)) b.rules.push({ when: 'newThingNear', do: 'observe', priority: 4 });
  if (/浪|危险|逃|躲灾/.test(trend + react)) b.rules.push({ when: 'dangerNear', do: 'flee', priority: 10 });
  if (/热闹|围|挤/.test(trend)) b.rules.push({ when: 'crowded', do: 'retreat', priority: 3 });

  if (b.rules.length === 0) b.rules.push({ when: 'newThingNear', do: 'approach', priority: 3 });
  return b;
}

// 白名单过闸：非法 when/do 砍掉；缺失字段兜底默认；保证 runBehavior 不崩
export function validateBehavior(raw: unknown): BehaviorV1 {
  if (!raw || typeof raw !== 'object') return ruleBehavior({});
  const r = raw as Record<string, unknown>;
  const b = defaultBehavior();

  if (r.body && typeof r.body === 'object') {
    const body = r.body as Record<string, unknown>;
    b.body = {
      senseRadius: clampN(body.senseRadius, 0.5, 3, 1),
      personalSpace: clampN(body.personalSpace, 20, 200, 60),
      speedMul: clampN(body.speedMul, 0.3, 3, 1),
      dwellSec: clampN(body.dwellSec, 0.5, 10, 2),
      reactionDelaySec: clampN(body.reactionDelaySec, 0, 5, 0),
      temperSec: clampN(body.temperSec, 0, 10, 0),
    };
  }
  if (r.seek && typeof r.seek === 'object') {
    const s = r.seek as Record<string, unknown>;
    b.seek = {
      people: clampN(s.people, -3, 3, 0),
      resources: clampN(s.resources, -3, 3, 0),
      events: clampN(s.events, -3, 3, 0),
    };
  }
  if (Array.isArray(r.rules)) {
    const rules: { when: string; do: string; priority?: number }[] = [];
    for (const item of r.rules) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      const when = String(it.when || '');
      const do_ = String(it.do || '');
      if (!(WHEN_CONDITIONS as readonly string[]).includes(when)) continue;
      if (!(DO_ACTIONS as readonly string[]).includes(do_)) continue;
      rules.push({ when, do: do_, priority: Number.isFinite(Number(it.priority)) ? Number(it.priority) : 0 });
    }
    b.rules = rules.length ? rules : ruleBehavior({}).rules;
  } else {
    b.rules = ruleBehavior({}).rules;
  }
  return b;
}

const SYS = `你是《我的世界》行为解释器。把学生六块设计（创造/交流/反应/资源/潮流/成长）翻译成一份"行为说明书"JSON。
字段：body{senseRadius(0.5-3),personalSpace(20-200),speedMul(0.3-3),dwellSec(0.5-10),reactionDelaySec(0-5),temperSec(0-10)}、seek{people,resources,events 数值权重，可负}、rules[{when,do,priority}]。
when 只能从：dangerNear,hitBy,strangerNear,friendHurt,friendThreatened,newThingNear,crowded。
do 只能从：flee,retreat,observe,approach,help,confront,gather。
语义：friendHurt=伙伴受伤要去帮；friendThreatened=伙伴被威胁要去护；strangerNear=有陌生生命靠近；hitBy=自己被撞；dangerNear=浪潮/灾近；newThingNear=看到新东西；crowded=周围太挤。
只输出 JSON，不要 markdown 代码块。`;

// AI 综合解释：六块 → behavior；任何失败回退规则版
export async function interpretBehavior(six: Record<string, unknown>): Promise<BehaviorV1> {
  const user = `六块设计：\n${JSON.stringify(six)}\n请输出行为说明书 JSON。`;
  try {
    const content = await chatWithLLM([{ role: 'user', content: user }], SYS, {
      json: true,
      temperature: 0.4,
      maxTokens: 900,
      timeoutMs: 20000,
    });
    const parsed = (() => {
      try { return JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
    })();
    if (parsed && Array.isArray(parsed.rules) && parsed.rules.length) return validateBehavior(parsed);
    return ruleBehavior(six);
  } catch {
    return ruleBehavior(six);
  }
}
