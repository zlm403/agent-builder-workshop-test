// =========================================================
// 《我的世界》表现规格（LifeSpec）
// 每个学员的生命专属一份：AI 读学员设定生成的"表现规格"，
// 大屏通用执行器读它调能力库播放。新行为 = 新规格数据，不用改大屏代码。
// 能力库是有限的，AI 只能从库内动作组合；未知动作执行器回退文字标签。
// =========================================================

// 一次性表现动作（大屏播放一次的效果）
export type SpecAction =
  | { do: 'emitSelf'; n?: number; to?: 'self' | 'other' }
  | { do: 'lightLink'; to?: 'self' | 'other' }
  | { do: 'scale'; value: number }
  | { do: 'dim' }
  | { do: 'glow' }
  | { do: 'jitter' }
  | { do: 'flash' }
  | { do: 'bubble' }
  | { do: 'cry' }
  | { do: 'dance' }
  | { do: 'fade' }
  | { do: 'miniSelf' }
  | { do: 'orbit' }
  | { do: 'nuzzle' }
  | { do: 'approach' }
  | { do: 'avoid' }
  // 未知原语兜底（AI 命名了新词但能力库未实现 → 大屏回退文字标签）
  | { do: string; [k: string]: unknown };

// 表现规格：学员专属的一份数据
export interface LifeSpec {
  body: 'sketch' | string; // 身体样式：用学员草图
  onMeet: SpecAction[]; // 相遇
  onHit: SpecAction[]; // 碰撞/受击
  onResource: SpecAction[]; // 获得资源
  onWave: SpecAction[]; // 挥手/交流信号
  onGrow: SpecAction[]; // 成长/升级
  onDeath: SpecAction[]; // 死亡/消失
  mood: Record<string, string>; // 情绪词 → 移动倾向（害羞→avoid，好奇→approach）
  [k: string]: unknown; // AI 可附加未知字段
}

// 六块技能（方案 A：学生逐块对话定义，AI 逐块生成规格片段）
export type SpecBlockKey = 'create' | 'social' | 'react' | 'resource' | 'trend' | 'grow';

export const SPEC_BLOCKS: { key: SpecBlockKey; title: string; desc: string }[] = [
  { key: 'create', title: '创造', desc: '它是什么样？给它一个名字、颜色、长相' },
  { key: 'social', title: '交流', desc: '它遇到别的生命时，会怎么表现？' },
  { key: 'react', title: '反应', desc: '它被打到/碰到时，会有什么反应？' },
  { key: 'resource', title: '资源', desc: '它吃到资源时，会怎么样？' },
  { key: 'trend', title: '潮流', desc: '它的心情/性格，会让它怎么移动？' },
  { key: 'grow', title: '成长', desc: '它长大或消失时，会怎么样？' },
];

export function defaultSpec(): LifeSpec {
  return {
    body: 'sketch',
    onMeet: [{ do: 'lightLink', to: 'other' }],
    onHit: [{ do: 'jitter' }],
    onResource: [{ do: 'glow' }],
    onWave: [{ do: 'approach' }],
    onGrow: [{ do: 'scale', value: 1.3 }],
    onDeath: [{ do: 'fade' }],
    mood: {},
  };
}

// 把六块逐块生成的片段 merge 成完整规格（后写覆盖前写）
export function mergeSpec(parts: Partial<LifeSpec>[]): LifeSpec {
  const base = defaultSpec();
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.body === 'string') base.body = p.body;
    for (const key of ['onMeet', 'onHit', 'onResource', 'onWave', 'onGrow', 'onDeath'] as const) {
      const v = (p as Record<string, unknown>)[key];
      if (Array.isArray(v) && v.length > 0) (base as Record<string, unknown>)[key] = v;
    }
    if (p.mood && typeof p.mood === 'object') {
      Object.assign(base.mood, p.mood);
    }
  }
  return base;
}

// 规范动作列表：过滤非法动作、兜底默认动作
const KNOWN_DO = new Set([
  'emitSelf', 'lightLink', 'scale', 'dim', 'glow', 'jitter', 'flash',
  'bubble', 'cry', 'dance', 'fade', 'miniSelf', 'orbit', 'nuzzle', 'approach', 'avoid',
]);

export function sanitizeActions(acts: unknown): SpecAction[] {
  if (!Array.isArray(acts)) return [];
  const out: SpecAction[] = [];
  for (const a of acts) {
    if (!a || typeof a !== 'object') continue;
    const rec = a as Record<string, unknown>;
    const doName = String(rec.do ?? '').trim();
    if (!doName) continue;
    if (!KNOWN_DO.has(doName)) continue; // 未实现原语不进规格（避免执行器兜底噪音）
    if (doName === 'emitSelf') {
      out.push({
        do: 'emitSelf',
        n: Math.max(1, Math.min(12, Number(rec.n) || 3)),
        to: rec.to === 'other' ? 'other' : 'self',
      });
      continue;
    }
    if (doName === 'lightLink') {
      out.push({ do: 'lightLink', to: rec.to === 'other' ? 'other' : 'self' });
      continue;
    }
    if (doName === 'scale') {
      const v = Number(rec.value);
      out.push({ do: 'scale', value: Number.isFinite(v) ? Math.min(3, Math.max(0.2, v)) : 1.2 });
      continue;
    }
    out.push({ do: doName } as SpecAction);
  }
  return out;
}

// 外部规格（AI 输出）→ 规范 LifeSpec，缺失字段兜底默认
export function normalizeSpec(raw: unknown): LifeSpec {
  const base = defaultSpec();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  base.body = typeof r.body === 'string' && r.body ? String(r.body) : 'sketch';
  for (const key of ['onMeet', 'onHit', 'onResource', 'onWave', 'onGrow', 'onDeath'] as const) {
    const s = sanitizeActions(r[key]);
    if (s.length) (base as Record<string, unknown>)[key] = s;
  }
  if (r.mood && typeof r.mood === 'object') {
    for (const [k, v] of Object.entries(r.mood as Record<string, unknown>)) {
      if (typeof v === 'string') base.mood[k] = v;
    }
  }
  return base;
}

// 规则回退：无 AI 时按文字关键词生成默认规格
export function ruleSpec(text: string): LifeSpec {
  const spec = defaultSpec();
  if (/躲|回避|远离|害羞|内向|怕生|警惕/.test(text)) {
    spec.mood['害羞'] = 'avoid';
    spec.onMeet = [{ do: 'jitter' }, { do: 'avoid' }];
  }
  if (/好奇|探索|凑近|想看看|爱凑热闹|兴奋/.test(text)) {
    spec.mood['好奇'] = 'approach';
    spec.onMeet = [{ do: 'emitSelf', n: 3, to: 'other' }, { do: 'lightLink', to: 'other' }];
  }
  if (/帮助|助人|照顾|帮忙|分享/.test(text)) {
    spec.onWave = [{ do: 'glow' }, { do: 'approach' }];
  }
  if (/闪光|亮|发光|星星|闪耀/.test(text)) spec.onResource = [{ do: 'flash' }, { do: 'emitSelf', n: 2, to: 'self' }];
  if (/跳舞|转圈|开心|高兴/.test(text)) spec.onGrow = [{ do: 'dance' }, { do: 'scale', value: 1.3 }];
  return spec;
}
