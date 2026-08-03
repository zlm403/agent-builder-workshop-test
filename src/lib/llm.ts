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

export async function chatWithLLM(
  messages: ChatMessage[],
  system?: string,
  options?: LLMOptions,
): Promise<string> {
  const config = getLLMConfig();
  const timeoutMs = options?.timeoutMs ?? 60000;

  // 离线（无 API Key）：返回内置 mock，保证流程可演示。
  if (!config.apiKey) {
    return mockReply(messages, system);
  }

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

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM 请求失败（${res.status}）${text ? `：${text}` : ''}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// 离线 mock：基于完整对话历史给出结构性回复。
// 当对话内容涉及 A1（小林/考研/30 分钟训练）时，按「诊断→设计→出题→检查」四步引导学生；
// 其他场景则给出通用但可执行的追问式回复。
function mockReply(messages: ChatMessage[], system?: string): string {
  const convo = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const users = convo.filter((m) => m.role === 'user');
  const lastUser = users[users.length - 1]?.content || '';
  const allUserText = users.map((m) => m.content).join('\n');

  const isA01 =
    /A1|A01|小林|考研|阅读训练|30 分钟训练|训练设计/.test(system || '') ||
    /小林|考研|30 分钟|长难句|错因|薄弱|最主要|阅读材料/.test(allUserText);

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
  const hasProblem = /长难句结构拆解弱/.test(allText);
  const hasTraining = /0–5 分钟：选 1 句真题长难句/.test(allText);
  const hasQuestion = /下面是一道与阅读材料相关的选择题/.test(allText);
  const hasVerify = /检查依据时，重点看三点/.test(allText);

  // 用户是否显式询问某一步（优先级高于“继续”）
  const asksProblem = /问题|诊断|长难句|常识|错因|薄弱|最主要|主要问题|小林的问题/.test(lastUser);
  const asksTraining = /训练|30\s*分钟|步骤|流程|设计|方案|计划|安排|这节课/.test(lastUser);
  const asksQuestion = /测试题|题目|出题|选择题|考题|练习题|做一题|出一道/.test(lastUser);
  const asksVerify = /依据|核对|检查|验证|原文|出处|符合材料|对一下|再检查|指回原文/.test(lastUser);

  const wantsNext =
    /继续|下一步|往下|接着|展开|详细|好[,，]?\s*(继续|下一步|往下|接着|展开|详细)?/.test(lastUser);
  const wantsDirect = /不要提|不要我提醒|别提醒|直接给|直接做|少说废话|别废话|直接说|直接写/.test(lastUser);

  // 首次进入或学生还在观望：给出四步框架 + 第一句可复制提示
  if (users.length === 1 && !hasProblem && !hasTraining && !hasQuestion && !hasVerify) {
    if (wantsDirect) {
      return wrapUpReply();
    }
    return [
      '好的，我们一起来完成小林的训练设计。建议按下面四步推进：',
      '1️⃣ 诊断问题：根据材料判断小林最主要的学习问题；',
      '2️⃣ 设计训练：基于材料设计一次约 30 分钟、可执行的训练；',
      '3️⃣ 生成测试题：让 AI 出一道与材料相关的选择题；',
      '4️⃣ 检查依据：核对 AI 给出的内容是否能在原文中找到出处。',
      '',
      '你可以从第一步开始，直接复制下面这句话发给我：',
      '“请根据资料分析小林最主要的学习问题，并说明你的判断依据。”',
    ].join('\n');
  }

  // “继续/下一步/不要提醒” → 根据当前进度推进到下一步
  if (wantsNext || wantsDirect) {
    if (wantsDirect) return wrapUpReply();
    if (!hasProblem) return problemReply(true);
    if (!hasTraining) return trainingReply(true);
    if (!hasQuestion) return questionReply(true);
    if (!hasVerify) return verifyReply(true);
    return wrapUpReply();
  }

  // 学生主动提到某一步 → 聚焦回答这一步
  if (asksProblem) {
    return problemReply(false);
  }
  if (asksTraining) {
    return trainingReply(false);
  }
  if (asksQuestion) {
    return questionReply(false);
  }
  if (asksVerify) {
    return verifyReply(false);
  }

  // 兜底：给出进度清单和下一步可复制提示
  return progressReply({ hasProblem, hasTraining, hasQuestion, hasVerify });
}

function problemReply(continueMode: boolean): string {
  const base = [
    '根据材料，小林的主要问题可以归纳为三点：',
    '1）长难句结构拆解弱：遇到嵌套从句容易断错主干；',
    '2）用常识替代原文：做题时凭“感觉”选，而不是回原文找依据；',
    '3）错后不归因：只看答案对错，不写错因，导致同类错误反复出现。',
    '其中最需要优先解决的是“用常识替代原文”，因为它直接影响阅读理解的稳定性。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，进入 30 分钟训练设计：',
    '“基于上面的问题，请帮我设计一份约 30 分钟、小林可以独立完成的训练。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '需要我针对哪一点再展开，或继续设计训练？'].join('\n');
}

function trainingReply(continueMode: boolean): string {
  const base = [
    '基于小林的问题，我建议这样安排 30 分钟训练：',
    '• 0–5 分钟：选 1 句真题长难句，先让学生自己画主干，再对照解析；',
    '• 5–20 分钟：限时做 1 篇阅读，每题作答时必须用括号标注“依据第 X 段第 Y 句”；',
    '• 20–25 分钟：对答案，但只看“是否指回原文”，不纠结对错；',
    '• 25–30 分钟：任选 1 道错题，写一句话错因并贴出原文出处。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，生成测试题：',
    '“请根据刚才的训练内容，给小林出一道与阅读材料相关的选择题，并给出答案和原文依据。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '你觉得这个时间分配合适吗？需要我调整或继续出题？'].join('\n');
}

function questionReply(continueMode: boolean): string {
  const base = [
    '下面是一道与阅读材料相关的选择题：',
    '题目：根据材料，作者认为远程办公对组织长期影响最大的是？',
    'A. 员工个人的任务产出',
    'B. 团队内部的知识共享与协作效率',
    'C. 公司整体运营成本',
    'D. 上下班通勤时间的减少',
    '答案：B',
    '原文依据：材料第二段提到，“远程办公虽然提高了个人专注度，却让跨部门的知识分享变得更加稀疏”，这对应选项 B。',
  ];
  const next = [
    '',
    '下一步：请复制下面这句话发给我，完成依据检查：',
    '“请帮我检查这道题的答案和依据，是否真正能在材料原文中找到对应，而不是常识推断。”',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '需要我换一道题，或者帮你检查这道题的依据？'].join('\n');
}

function verifyReply(continueMode: boolean): string {
  const base = [
    '检查依据时，重点看三点：',
    '1）答案是否能在材料中找到直接对应，而不是“可能”“大概”；',
    '2）长难句的主干是否断对，避免把修饰成分当成主句；',
    '3）每个排除的干扰项，都能在原文中说出“它为什么不对”。',
    '',
    '以刚才那道题为例：选项 B 的“知识共享与协作效率”直接对应原文“knowledge sharing became sparser”，属于可指回的原文信息；而选项 A、C、D 都偏向常识或文中未展开的细节。',
  ];
  const next = [
    '',
    '四步已经完成。如果你认可这套训练，可以点击页面下方的“提交”按钮；',
    '如果想修改，可以继续告诉我，比如“把训练时间改成 20 分钟”或“换一道更难的测试题”。',
  ];
  return continueMode ? [...base, ...next].join('\n') : [...base, '', '你还有其他想调整的地方吗？'].join('\n');
}

function wrapUpReply(): string {
  return [
    '很好，我们已经一起完成了诊断、训练设计、出题和依据检查四步。',
    '',
    '最终方案概要：',
    '• 核心问题：用常识替代原文、长难句结构弱、错后不归因；',
    '• 30 分钟训练：5 分钟长难句 + 15 分钟限时阅读并标注依据 + 10 分钟错因分析；',
    '• 测试题：远程办公对组织长期影响最大的是 B（团队知识共享与协作效率），依据在材料第二段；',
    '• 依据检查：所有结论都能指回原文，避免常识推断。',
    '',
    '如果没问题，请点击“提交”。想再改哪里，直接告诉我。',
  ].join('\n');
}

function progressReply(progress: { hasProblem: boolean; hasTraining: boolean; hasQuestion: boolean; hasVerify: boolean }): string {
  const steps = [
    { done: progress.hasProblem, text: '1️⃣ 诊断小林的问题' },
    { done: progress.hasTraining, text: '2️⃣ 设计 30 分钟训练' },
    { done: progress.hasQuestion, text: '3️⃣ 生成测试题' },
    { done: progress.hasVerify, text: '4️⃣ 检查依据' },
  ];
  const todo = steps.find((s) => !s.done);
  const status = steps.map((s) => (s.done ? `✅ ${s.text.slice(2)}` : `⬜ ${s.text.slice(2)}`)).join('\n');

  const prompts: Record<string, string> = {
    problem: '“请根据资料分析小林最主要的学习问题。”',
    training: '“基于上面的问题，请帮我设计一份约 30 分钟、小林可以独立完成的训练。”',
    question: '“请根据刚才的训练内容，给小林出一道与阅读材料相关的选择题，并给出答案和原文依据。”',
    verify: '“请帮我检查这道题的答案和依据，是否真正能在材料原文中找到对应。”',
  };
  const key = todo?.text.includes('诊断') ? 'problem'
    : todo?.text.includes('设计') ? 'training'
    : todo?.text.includes('测试题') ? 'question'
    : 'verify';

  return [
    '当前进度：',
    status,
    '',
    '下一步可以直接复制发给我：',
    prompts[key],
  ].join('\n');
}
