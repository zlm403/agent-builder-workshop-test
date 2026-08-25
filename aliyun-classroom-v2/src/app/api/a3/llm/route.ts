import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';
import { SPEC_BLOCKS, type SpecBlockKey, type LifeSpec, normalizeSpec, ruleSpec } from '@/lib/world/spec';

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

// 能力库枚举（大屏通用执行器已实现的动作；AI 只能从这里选）
const CAPABILITY_LIST = [
  'emitSelf 发射自己的小星星（学员草图像素）',
  'lightLink 向对方发射一条光带连线',
  'miniSelf 飞出一个缩小版自己（草图）去接触对方',
  'scale 变大/变小（value 为倍数）',
  'dim 变暗',
  'glow 发光',
  'jitter 抖动',
  'flash 闪光',
  'bubble 冒泡',
  'cry 掉泪',
  'dance 转圈跳舞',
  'fade 飘散消失',
  'orbit 绕对方转圈',
  'nuzzle 蹭一蹭对方',
  'approach 主动靠近',
  'avoid 躲开',
].join('\n');

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

// 规范化 AI 输出的片段：只保留该块允许的字段，且动作必须来自能力库
function normalizeBlockSpec(block: SpecBlockKey, raw: Record<string, unknown>): Partial<LifeSpec> {
  const allowed = new Set(BLOCK_FIELDS[block]);
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const field = key.split('(')[0].trim() as keyof LifeSpec;
    if (raw[field] === undefined) continue;
    // mood 为空对象时丢弃（避免覆盖其它块的 mood）
    if (field === 'mood' && (!raw[field] || (typeof raw[field] === 'object' && Object.keys(raw[field] as object).length === 0))) continue;
    out[field] = raw[field];
  }
  // 只有 create 块可以带 body；其余块若无字段返回空（前端会 merge 默认值）
  return normalizeSpec(out) as Partial<LifeSpec>;
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
      `当前技能块：${validBlock}（${SPEC_BLOCKS.find((b) => b.key === validBlock)?.title}）——${BLOCK_FIELDS[validBlock].join('、')}`,
      `你可以组合的能力库（只能从这里选，不要发明新原语）：\n${CAPABILITY_LIST}`,
      '要求：根据学员对话，为该块生成一个贴切的「表现规格」片段，只包含上面列出的字段。',
      '规则：',
      '- 每个列表字段是一个动作数组，每个动作形如 {"do":"emitSelf","n":3,"to":"other"}，可组合多个。',
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
