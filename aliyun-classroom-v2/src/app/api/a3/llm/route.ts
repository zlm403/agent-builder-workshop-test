import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';
import { SPEC_BLOCKS, type SpecBlockKey, type LifeSpec, ruleSpec, sanitizeActions } from '@/lib/world/spec';

// =========================================================
// A3 《我的世界》 LLM 代理
// 学生端（浏览器）无 key，经此代理调用教师端配置的 DeepSeek。
// 职责（方案 A · 六块逐块定义）：
//   extract 模式：学生跟 AI 逐块对话（创造/交流/反应/资源/潮流/成长），
//                 每块生成该生命专属的「表现规格」片段（LifeSpec 的部分字段）。
//                 学生六块走完后，学生端把六块片段 merge 成完整 spec 提交。
// 能力库枚举：AI 只能从能力库动作里组合，不发明新原语；语义含糊返回 followup。
// 失败规则回退：ruleSpec(text) 按关键词生成默认规格，绝不 502 中断。
// =========================================================

export const dynamic = 'force-dynamic';

// 注：原「能力库枚举」已废弃——A3 表现改由 AI 直接生成自包含 SVG 动画（见下方 extract 模式）。
// 6 块（创造/交流/反应/资源/潮流/成长）仍是引导学生设计生命的骨架，AI 在读懂学生「这一块」的描述后，
// 把该块表现直接画成 SVG；词表仅作为规则回退（ruleSpec）兜底，不再约束 AI 输出。

// 六块 → 该块可写入的 LifeSpec 字段
const BLOCK_FIELDS: Record<SpecBlockKey, string[]> = {
  create: ['body', 'name(仅展示)', 'color(仅展示)'],
  social: ['onMeet(相遇时)', 'onWave(交流时)', 'mood(情绪→移动)'],
  react: ['onHit(受击/碰撞时)'],
  resource: ['onResource(吃到资源时)'],
  trend: ['mood(心情→移动倾向，格式 {"情绪词":"avoid或approach"}；害羞→avoid、好奇→approach、爱热闹→approach、怕生→avoid，情绪词用学员原话的中文词)'],
  grow: ['onGrow(长大/升级时)', 'onDeath(消失时)'],
};

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

// 规则回退：按块 + 关键词生成该块规格片段
function ruleSpecForBlock(block: SpecBlockKey, text: string): Partial<LifeSpec> {
  const full = ruleSpec(text);
  switch (block) {
    case 'social':
      return { onMeet: full.onMeet, onWave: full.onWave, mood: full.mood };
    case 'react':
      return { onHit: full.onHit };
    case 'resource':
      return { onResource: full.onResource };
    case 'trend':
      return { mood: full.mood };
    case 'grow':
      return { onGrow: full.onGrow, onDeath: full.onDeath };
    case 'create':
    default:
      return {};
  }
}

// 规范化 AI 输出的片段：只保留该块允许的字段。
// 注意：返回「只含本块字段」的部分规格，不做全量兜底——否则 merge 时
// 后面的块会带上完整默认 spec 把前面块的设计全覆盖成默认值（历史 bug）。
// 每个字段内部做动作/字段清洗，缺失字段不补默认。
function normalizeBlockSpec(block: SpecBlockKey, raw: Record<string, unknown>): Partial<LifeSpec> {
  // 该块可写的字段（键名）
  const fieldKeys: Partial<Record<SpecBlockKey, (keyof LifeSpec)[]>> = {
    create: ['body'],
    social: ['onMeet', 'onWave', 'mood'],
    react: ['onHit'],
    resource: ['onResource'],
    trend: ['mood'],
    grow: ['onGrow', 'onDeath'],
  };
  const keys = fieldKeys[block] ?? [];
  const out: Partial<LifeSpec> = {};
  for (const field of keys) {
    if (raw[field] === undefined) continue;
    if (field === 'mood') {
      // mood 为空对象时丢弃（避免覆盖其它块的 mood）
      if (!raw[field] || (typeof raw[field] === 'object' && Object.keys(raw[field] as object).length === 0)) continue;
      const m: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw[field] as Record<string, unknown>)) {
        if (typeof v === 'string') m[k] = v;
      }
      if (Object.keys(m).length) out.mood = m;
    } else if (field === 'body') {
      if (typeof raw[field] === 'string' && raw[field]) out.body = String(raw[field]);
    } else {
      // 动作数组 → 清洗（sanitizeActions 只保留能力库动作，svg 走 sanitizeSvg）
      const acts = sanitizeActions(raw[field]);
      if (acts.length) (out as Record<string, unknown>)[field] = acts;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // —— 提取模式：按块从对话生成该块的表现规格片段 ——
  if (body.extract) {
    const blockRaw = String(body.block || '');
    const convo = String(body.convo || '');
    const fields = (body.fields && typeof body.fields === 'object' ? body.fields : {}) as Record<string, unknown>;

    // —— 中文六块兼容（当前 student.html / bigscreen.html 走的格式：fields 结构 + 中文 block）——
    const CN_BLOCK: Record<string, string> = { 创造:'创造', 交流:'交流', 反应:'反应', 资源:'资源', 潮流:'潮流', 成长:'成长' };
    if (CN_BLOCK[blockRaw]) {
      const CN_SCHEMA: Record<string, string> = {
        创造: '提取 JSON：{name,shape,blurb}。shape 必须是「学员描述的形状」的 SVG 字符串（<svg viewBox="0 0 100 100" width="100" height="100">…</svg>，用纯色 path/polygon/circle 拼出形状轮廓，填白色 #fff，不用文字图片）；学员没提形状才用"光斑"两字。name 是生命名，blurb 是学员原话的一句话。',
        交流: '提取 JSON：{approach,avoid,onMeet,visuals}。visuals 是表现原语数组，每项为对象 {action,color?,label?}：action 从 [lightLink 光带连线, emitSelf 撒自己的小星星, nuzzle 蹭一下, spit 吐个小东西, orbit 绕着转, avoid 躲开, dance 打招呼] 选；color 用学员说的颜色（如"红色"→red，"绿色的光"→#4ade80），没说就不填；label 是学员原话里这个表现的简短描述。',
        反应: '提取 JSON：{manifest,dropDims,visuals}。dropDims 是优先扣的维度名数组；visuals 为对象数组 {action,color?}：action 从 [shrink 缩成一团, jitter 发抖, dim 变暗, bubble 冒泡泡, cry 哭泣, flash 闪光] 选；color 用学员说的颜色，没说则不填。',
        资源: '提取 JSON：{consume,visuals}。visuals 为对象数组 {action,color?}：action 从 [grow 慢慢长大, devour 吃掉, glow 发光, dance 开心转圈] 选；color 用学员说的颜色，没说则不填。',
        潮流: '提取 JSON：{mode,visuals}。visuals 为对象数组 {action,color?}：action 从 [follow 随波而行, resist 逆流而上, still 静静观看] 选；color 用学员说的颜色，没说则不填。',
        成长: '提取 JSON：{grow,death,visuals}。visuals 为对象数组 {action,color?}：action 从 [grow 长大一圈, fade 缓缓飘散] 选；color 用学员说的颜色，没说则不填。',
      };
      const sys = '你是共生缸共创助教。' + CN_SCHEMA[blockRaw] + ' 只输出 JSON，不要 markdown 代码块。';
      const user = `学员在本块的对话：\n${convo || '（无对话）'}\n请输出 JSON。`;
      try {
        const content = await chatWithLLM([{ role: 'user', content: user }], sys, { json: true, temperature: 0.4, maxTokens: 900, timeoutMs: 20000 });
        const parsed = (() => { try { return JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { return null; } } return null; } })();
        if (parsed && typeof parsed === 'object' && !parsed.followup) {
          return NextResponse.json({ ok: true, block: blockRaw, fields: parsed });
        }
        if (parsed && parsed.followup) {
          return NextResponse.json({ ok: true, block: blockRaw, fields: { followup: String(parsed.followup) } });
        }
      } catch { /* fallthrough */ }
      return NextResponse.json({ ok: false, block: blockRaw, fields: null });
    }

    const block = blockRaw as SpecBlockKey;
    const validBlock = SPEC_BLOCKS.some((b) => b.key === block) ? block : 'social';

    const sys = [
      '你是《我的世界》里帮学生把想法变成生命表现的共创助教。',
      `当前技能块：${validBlock}（${SPEC_BLOCKS.find((b) => b.key === validBlock)?.title}）——这块要填的字段：${BLOCK_FIELDS[validBlock].join('、')}`,
      '注意：6 块（创造/交流/反应/资源/潮流/成长）是引导学生设计生命的骨架，你要在「读懂学生这一块的描述」之后，再产出这一块的表现。',
      '要求：根据该块学员对话，生成这一块的「表现规格」片段（JSON）。表现用「自包含 SVG 动画」画出来，不是从固定动作里选。',
      '规则：',
      "- 输出 JSON，只包含该块允许的字段。每个表现字段是一个数组，每项形如 {\"do\":\"svg\",\"svg\":\"<svg viewBox='0 0 200 200' width='100%' height='100%'>…</svg>\"}。",
      "- SVG 规范：根元素 <svg viewBox='0 0 200 200' width='100%' height='100%'>；只用 SMIL <animate>/<animateTransform> 或内联 <style>@keyframes 做动画；禁止 <script>、on* 属性、外部 href、foreignObject、外部图片；颜色用学员说的（\"红色\"→#ef4444、\"金色\"→#fbbf24、\"光\"→#7dd3fc），没说用生命主色 #7dd3fc；动画≤1.6秒、循环或播一次；不要文字、不要外部资源。",
      "- 表现要贴合该块描述：交流块学生说\"一道光锁定对方、光波传过去\"，就画一束光伸过去+扩散波；反应块说\"被揍就缩成一团发抖\"，就画缩小抖动；资源块说\"吃到就发光\"，就画光晕扩散；潮流块说\"随波而行\"，就画它顺着某个方向轻飘。",
      '- 若学员描述模糊、无法确定，输出额外字段 "followup"（一个追问学员的短问题），并给出最可能的猜测值。',
      '只输出 JSON（不要 markdown 代码块）。',
    ].join('\n');
    const user = [
      `学员在本块的对话：\n${convo || '（无对话，按最中性表现生成）'}`,
      `当前已生成的其它块设定：${JSON.stringify(fields)}`,
      '请输出 JSON。',
    ].join('\n');

    let spec: Partial<LifeSpec>;
    let followup = '';
    try {
      const content = await chatWithLLM([{ role: 'user', content: user }], sys, {
        json: true,
        temperature: 0.4,
        maxTokens: 700,
        timeoutMs: 20000,
      });
      const parsed = extractJson(content);
      if (parsed) {
        followup = String(parsed.followup ?? '');
        spec = normalizeBlockSpec(validBlock, parsed);
      } else {
        spec = ruleSpecForBlock(validBlock, convo);
      }
    } catch {
      spec = ruleSpecForBlock(validBlock, convo);
    }
    return NextResponse.json({ ok: true, block: validBlock, spec, followup });
  }

  // —— 引导模式：正常对话引导（六块定义时学生先聊，AI 口语化引导） ——
  const sys = '你是《我的世界》的共创助教。学生在逐块设计他的数字生命（创造/交流/反应/资源/潮流/成长），你口语化引导他描述清楚这个生命会怎么表现。一次只问一个问题。不要替学生做决定，你只是帮他把想法说具体。';
  const reply = await chatWithLLM([{ role: 'user', content: String(body.message || '') }], sys, {
    temperature: 0.7,
    maxTokens: 400,
  }).catch((err: Error) => `__ERR__${err.message}`);
  if (reply.startsWith('__ERR__')) {
    return NextResponse.json({ ok: false, error: reply.slice(7) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, reply });
}
