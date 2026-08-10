// 可插拔 LLM 适配器。
// 未配置 LLM_API_KEY 时使用内置 mock 回复，保证整套流程可离线演示；
// 在教师端「设置」里填入 DeepSeek API Key，或在 .env.local 中设置 LLM_API_KEY，即可切换为真实模型。

import { getLLMConfig } from './serverEnv';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  model?: string; // 允许覆盖模型（用于快速降级模型）
}

export class LLMError extends Error {
  code: 'TIMEOUT' | 'SERVICE_BUSY' | 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'EMPTY' | 'UNKNOWN';
  status?: number;
  constructor(code: LLMError['code'], message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// 单次调用：分类错误抛出 LLMError
async function callLLMOnce(
  messages: ChatMessage[],
  system: string | undefined,
  options: LLMOptions | undefined,
  config: ReturnType<typeof getLLMConfig>,
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: options?.model ?? config.model,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.maxTokens) body.max_tokens = options.maxTokens;
    if (options?.json) body.response_format = { type: 'json_object' };

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) throw new LLMError('TIMEOUT', 'LLM 响应超时');
      throw new LLMError('NETWORK', `LLM 网络异常：${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const status = res.status;
      if (status === 401 || status === 403) {
        throw new LLMError('AUTH', `LLM 鉴权失败（${status}）`, status);
      }
      if (status === 429) {
        throw new LLMError('RATE_LIMIT', `LLM 请求过快（429）`, status);
      }
      if (status >= 500) {
        // 5xx（含 503 service_unavailable）：服务繁忙，调用方可重试
        throw new LLMError('SERVICE_BUSY', `LLM 服务繁忙（${status}）`, status);
      }
      throw new LLMError('UNKNOWN', `LLM 请求失败（${status}）：${text}`, status);
    }

    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new LLMError('NETWORK', 'LLM 响应解析失败');
    }
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new LLMError('EMPTY', 'LLM 返回内容为空');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function chatWithLLM(
  messages: ChatMessage[],
  system?: string,
  options?: LLMOptions,
): Promise<string> {
  const config = getLLMConfig();

  // 离线（无 API Key）：返回内置 mock，保证流程可演示。
  if (!config.apiKey) {
    return mockReply(messages, system);
  }

  // 5xx / 429 / 网络 / 超时自动重试（最多 2 次，间隔 1s / 2s）
  const maxRetries = 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLLMOnce(messages, system, options, config);
    } catch (err) {
      lastErr = err;
      if (
        err instanceof LLMError &&
        (err.code === 'SERVICE_BUSY' || err.code === 'RATE_LIMIT' || err.code === 'NETWORK' || err.code === 'TIMEOUT') &&
        attempt < maxRetries
      ) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// 离线 mock：基于完整对话历史给出结构性回复。
// 当对话内容涉及 A1（四级词汇急救 / 10 天计划 / 400 词）时，按「诊断→设计→复习与自测→检查」四步引导学生；
// 其他场景则给出通用但可执行的追问式回复。
function mockReply(messages: ChatMessage[], system?: string): string {
  const convo = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const users = convo.filter((m) => m.role === 'user');
  const lastUser = users[users.length - 1]?.content || '';
  const allUserText = users.map((m) => m.content).join('\n');

  const isA01 =
    /A1|A01|四级|400 词|400词|10 天|10天|急救计划|词汇|背单词|背了就忘/.test(system || '') ||
    /四级|400 词|400词|10 天|10天|急救|词汇|背单词|背了就忘|形近词/.test(allUserText);

  if (isA01) {
    return a01MockReply(convo, lastUser);
  }

  // 通用 fallback：让学生补齐三要素，而不是泛泛地“需要我继续吗”
  if (/计划|方案|学习|怎么做|如何做/.test(lastUser)) {
    return '好的，我可以帮你一起设计方案。为了给出更贴合的内容，请补充：1）这件事的对象是谁；2）你手上有哪些资料或限制；3）最终要交付什么成果。';
  }
  return '收到。为了让下一步更具体，请从下面选一个告诉我：\n1）明确对象和目标；\n2）提供具体资料；\n3）指定想先完成的步骤；\n4）要求我给出每一步的依据。\n\n或者直接说“先做第 X 步”。';
}

// A1 专用 mock：根据学生已经聊了哪些内容，按四步递进引导。
function a01MockReply(convo: ChatMessage[], lastUser: string): string {
  const users = convo.filter((m) => m.role === 'user');
  const allUserText = users.map((m) => m.content).join('\n');
  const allText = convo.map((m) => m.content).join('\n');

  // 进度以 AI 已输出的阶段标记为准（避免“继续”时误判）
  const hasProblem = /没有回忆过程/.test(allText);
  const hasPlan = /每天 40 分钟啃新词/.test(allText);
  const hasMechanism = /第 5 天、第 10 天做整轮自测/.test(allText);
  const hasVerify = /检查依据时，重点看三点/.test(allText);

  // 用户是否显式询问某一步（优先级高于“继续”）
  const asksProblem = /问题|诊断|背了就忘|形近词|易混|错因|根因|为什么/.test(lastUser);
  const asksPlan = /计划|10\s*天|方案|安排|设计|步骤|流程|每天|安排/.test(lastUser);
  const asksMechanism = /复习|自测|间隔|回炉|错词|第5天|第 5 天|第10天|第 10 天|遗忘/.test(lastUser);
  const asksVerify = /依据|核对|检查|验证|可行|可执行|考场|3 小时|能背完/.test(lastUser);

  const wantsNext =
    /继续|下一步|往下|接着|展开|详细|好[,，]?\s*(继续|下一步|往下|接着|展开|详细)?/.test(lastUser);
  const wantsDirect = /不要提|不要我提醒|别提醒|直接给|直接做|少说废话|别废话|直接说|直接写/.test(lastUser);

  // 首次进入或学生还在观望：给出四步框架 + 第一句可复制提示
  if (users.length === 1 && !hasProblem && !hasPlan && !hasMechanism && !hasVerify) {
    if (wantsDirect) {
      return wrapUpReply();
    }
    return [
      '好的，我们一起来为这位学员设计 10 天四级词汇急救计划。建议按下面四步推进：',
      '1️⃣ 诊断问题：分析为什么 400 词背了就忘、形近词易混；',
      '2️⃣ 设计计划：基于 400 词库设计每天 ≤ 3 小时、可执行的 10 天安排；',
      '3️⃣ 复习与自测：加入间隔复习机制和第 5、10 天自测节点；',
      '4️⃣ 检查依据：核对计划是否真能在 10 天内执行、考场用得上。',
      '',
      '你可以从第一步开始，直接复制下面这句话发给我：',
      '“请根据资料分析这位学员最核心的词汇问题，并说明你的判断依据。”',
    ].join('\n');
  }

  // “继续/下一步/不要提醒” → 根据当前进度推进到下一步
  if (wantsNext || wantsDirect) {
    if (wantsDirect) return wrapUpReply();
    if (!hasProblem) return problemReply(true);
    if (!hasPlan) return planReply(true);
    if (!hasMechanism) return mechanismReply(true);
    if (!hasVerify) return verifyReply(true);
    return wrapUpReply();
  }

  // 学生主动提到某一步 → 聚焦回答这一步
  if (asksProblem) {
    return problemReply(false);
  }
  if (asksPlan) {
    return planReply(false);
  }
  if (asksMechanism) {
    return mechanismReply(false);
  }
  if (asksVerify) {
    return verifyReply(false);
  }

  // 兜底：给出进度清单和下一步可复制提示
  return progressReply({ hasProblem, hasPlan, hasMechanism, hasVerify });
}

function problemReply(continueMode: boolean): string {
  const base = [
    '根据资料，学员 400 个核心词“背了就忘、形近词易混”，最根本的问题有三点：',
    '1）没有回忆过程：只是反复“看”词表和释义，大脑没有主动提取，等于没记住；',
    '2）形近词靠感觉：absorb/absolute、adopt/adapt 这类容易混，从不做对比辨析；',
    '3）学完不回来：当天背完就扔，没有间隔复习，遗忘曲线让它基本归零。',
    '其中最需要优先解决的是“没有回忆过程”，因为它是背了就忘的根因。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，进入 10 天计划设计：',
    '“基于上面的问题，请基于 400 词库设计一份 10 天急救计划，每天不超过 3 小时。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '需要我针对哪一点再展开，或继续设计计划？'].join('\n');
}

function planReply(continueMode: boolean): string {
  const base = [
    '基于学员的问题，我建议这样安排每天（共 10 天）：',
    '• 每天 40 分钟啃新词：40 词分 4 组，每组“遮住释义自认 → 对照核对 → 标出错的”，而不是看一遍；',
    '• 每天 15 分钟复习旧词：只复习前一天错词 + 前 2 天全部，过一遍错的就进“错词回炉”；',
    '• 每天 15 分钟自测：从词库随机抽 10 词拼写 + 10 词选义；',
    '• 全天总时长约 70 分钟，最多不超过 3 小时，留出弹性。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，加上复习与自测机制：',
    '“请把间隔复习和第 5、10 天自测节点补进计划里，并说清错词怎么回炉。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '你觉得这个安排合理吗？需要我调整或继续加复习机制？'].join('\n');
}

function mechanismReply(continueMode: boolean): string {
  const base = [
    '好的，在每日安排之上，加入三组机制让“背了就忘”破局：',
    '• 间隔复习：新词学完后的第 1、3、7 天各复习一次；错词当天重过一遍；',
    '• 自测节点：第 5 天抽 Day1-5 共 50 词遮义自认，第 10 天全 400 词随机抽 100 词认读 + 20 词拼写；',
    '• 错词回炉：错词自动排入第 7、10 天复测，直到连续两次通过才“出库”。',
    '这样每天既有新词，又有针对遗忘的复习，考场能“认得出、选得对、写得对”。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，完成依据检查：',
    '“请帮我检查这份计划是否真能在 10 天内执行、每天不超过 3 小时，自测节点是否落到具体天数。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '需要我调整复习频率，或者继续检查计划？'].join('\n');
}

function verifyReply(continueMode: boolean): string {
  const base = [
    '检查依据时，重点看三点：',
    '1）计划是否真的能在 10 天内执行，而不是“每天背 400 词”这种不可能的任务；',
    '2）每天时间是否 ≤ 3 小时，且留出了复习和自测，而不是只啃新词；',
    '3）自测节点是否落到具体天数，错词回炉是否写清了“当天重过 + 第 7、10 天复测”。',
    '',
    '以这份计划为例：每天新词 + 复习 + 自测约 70 分钟，第 5/10 天有整轮自测，错词有回炉路径，属于可在 10 天内执行、考场能验证掌握的方案。',
  ];
  const next = [
    '',
    '四步已经完成。如果你认可这份计划，可以点击页面下方的“提交”按钮；',
    '如果想修改，可以继续告诉我，比如“把每天复习时间加到 30 分钟”或“自测再加一次”。',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '你还有其他想调整的地方吗？'].join('\n');
}

function wrapUpReply(): string {
  return [
    '很好，我们已经一起完成了诊断、计划设计、复习与自测、依据检查四步。',
    '',
    '最终方案概要：',
    '• 核心问题：没有回忆过程、形近词靠感觉、学完不复习；',
    '• 每日安排：40 分钟新词 + 15 分钟复习旧词 + 15 分钟自测（共约 70 分钟，≤ 3 小时）；',
    '• 复习机制：间隔复习（第 1/3/7 天）+ 错词回炉（当天 + 第 7/10 天复测）；',
    '• 自测节点：第 5 天 50 词、第 10 天 100 词认读 + 20 词拼写；',
    '• 依据检查：计划可在 10 天内执行，考场能认、能选、能写对。',
    '',
    '如果没问题，请点击“提交”。想再改哪里，直接告诉我。',
  ].join('\n');
}

function progressReply(progress: { hasProblem: boolean; hasPlan: boolean; hasMechanism: boolean; hasVerify: boolean }): string {
  const steps = [
    { done: progress.hasProblem, text: '1️⃣ 诊断词汇问题' },
    { done: progress.hasPlan, text: '2️⃣ 设计 10 天计划' },
    { done: progress.hasMechanism, text: '3️⃣ 复习与自测机制' },
    { done: progress.hasVerify, text: '4️⃣ 检查依据' },
  ];
  const todo = steps.find((s) => !s.done);
  const status = steps.map((s) => (s.done ? `✅ ${s.text.slice(2)}` : `⬜ ${s.text.slice(2)}`)).join('\n');

  const prompts: Record<string, string> = {
    problem: '“请根据资料分析这位学员最核心的词汇问题。”',
    plan: '“基于上面的问题，请基于 400 词库设计一份 10 天急救计划，每天不超过 3 小时。”',
    mechanism: '“请把间隔复习和第 5、10 天自测节点补进计划里，并说清错词怎么回炉。”',
    verify: '“请帮我检查这份计划是否真能在 10 天内执行、每天不超过 3 小时。”',
  };
  const key = todo?.text.includes('诊断') ? 'problem'
    : todo?.text.includes('计划') ? 'plan'
    : todo?.text.includes('自测') ? 'mechanism'
    : 'verify';

  return [
    '当前进度：',
    status,
    '',
    '下一步可以直接复制发给我：',
    prompts[key],
  ].join('\n');
}
