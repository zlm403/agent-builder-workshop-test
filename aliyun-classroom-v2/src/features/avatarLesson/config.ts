// =========================================================
// 数字分身课 · 第一关 A0 新版 + A1 数字分身
// 配置层：所有文案 / 步骤 / 提示词集中在这里，改这里即可调整课程。
// 模块 id 与类型：
//   A0N_QUESTIONS (a0_new)  A0-1 三问打字
//   A0N_VOTE      (a0_new)  A0-2 关系题投票
//   A0N_REVEAL    (a0_new)  A0-3 揭晓 + 讲解 + 两张艺术图
//   A1_AVATAR     (avatar_flow)  A1 数字分身 · 六步连续对话
// =========================================================

export const A0N_FIRST_MODULE = 'A0N_QUESTIONS';

// ---- A0-1 三问 ----
export interface A0Question {
  key: string;
  title: string;
  placeholder: string;
}

export const A0_QUESTIONS: A0Question[] = [
  {
    key: 'q1',
    title: '你平时会让 AI 帮你做什么？',
    placeholder: '例如：写文案、查资料、排行程、改作业…',
  },
  {
    key: 'q2',
    title: '有没有你想做、但觉得 AI 目前做不到的？',
    placeholder: '例如：替我发朋友圈、整理某个人所有的想法…',
  },
  {
    key: 'q3',
    title: '你最不满意的一次 AI 使用体验是什么？',
    placeholder: '例如：它答非所问、给的结果没法直接用…',
  },
];

// ---- A0-2 关系题（唯一一次投票）----
export interface A0VoteOption {
  id: 'tool' | 'partner';
  label: string;
  icon: string;
  desc: string;
}

export const A0_VOTE_OPTIONS: A0VoteOption[] = [
  {
    id: 'tool',
    label: '工具',
    icon: '🔧',
    desc: '需要时拿来用一下，用完就放下',
  },
  {
    id: 'partner',
    label: '伙伴',
    icon: '🤝',
    desc: '像一个搭档，长期陪我一起做成事',
  },
];

// ---- A0-3 揭晓 + 讲解 ----
export const A0_REVEAL = {
  headline: '你和 AI，是「工具」还是「伙伴」？',
  // 过去 vs 未来 流程对比
  pastVsFuture: {
    past: {
      title: '过去 · 把 AI 当工具',
      flow: ['拿到任务', '直接要结果', '用完就走'],
    },
    future: {
      title: '未来 · 把 AI 当伙伴',
      flow: ['说清对象', '拆解步骤', '校验结果', '沉淀为能力'],
    },
  },
  artImages: ['/avatar/A0-art-1.jpg', '/avatar/A0-art-2.jpg'],
};

// =========================================================
// A1 数字分身 · 六步（大屏 6 格 + 手机连续对话）
// =========================================================

export interface A1Step {
  key: string;
  name: string; // 大屏格子标题
  title: string; // 手机端当前阶段标题
  aiAsk: string; // AI 首次向学生发问的话（引导开场）
}

export const A1_STEPS: A1Step[] = [
  {
    key: 'dream',
    name: '提出梦想',
    title: '你想让「数字的你」替你做什么？',
    aiAsk:
      '如果我能变成"数字的你"——有一个和你一模一样、只听你的分身。你最希望它替你做什么？\n\n顺便告诉我：它替你省下的那些时间，你最想留给自己做什么？',
  },
  {
    key: 'path',
    name: '寻找路径',
    title: '选一条路，让分身先从小事做起',
    aiAsk:
      '要真正养出一个"数字的你"，通常有三条路：\n\nA · 一次做大的全能分身（难，易失控）\nB · 从一个你最常做的动作开始，养一个小的\nC · 先看看别人怎么做，再决定\n\n我更推荐 B——先从小事做起。你觉得呢？你想从哪个动作开始？',
  },
  {
    key: 'build',
    name: '创建分身',
    title: '我们一起画一张「数字的你」',
    aiAsk:
      '要成为你的分身，我得先足够了解你。接下来我会问你一些问题，问够为止——你回答得越具体，画出来的"数字的你"越像你。\n\n先从最基础的开始：你希望这个分身，在别人/你自己面前，是一个怎样的性格？',
  },
  {
    key: 'task',
    name: '定义任务',
    title: '给分身装上第一个 Skill',
    aiAsk:
      '你的第一个 Skill，我建议从「朋友圈表达」开始——这是每个人都会用到的。\n\n请告诉我：如果让数字的你替你发一条朋友圈，你想让它表达什么主题？（比如：你最近在忙的一件事 / 你欣赏的一种生活 / 一段想对某个人说的话）',
  },
  {
    key: 'plan',
    name: '选择方案',
    title: '挑一个方向，让分身开写',
    aiAsk:
      '给你三个创作方向，挑一个最合你心意的：\n\n① 生活画面：把你正在经历的这一刻，写成一条让人想停留的朋友圈\n② 个人态度：把你坚持的东西，写成一条有态度、不喊口号的朋友圈\n③ 分身反差：让"数字的你"和"真实的你"来一次反差对话，写成一条朋友圈\n\n你想选哪个？',
  },
  {
    key: 'iterate',
    name: '创作迭代',
    title: '一起把这条朋友圈，写到最好',
    aiAsk:
      '好，那就开始写吧。我会先给你三版草稿，你来选最像你的一版；如果你的成功率还不够高，我会告诉你差在哪、怎么改。\n\n准备好了吗？按一下「生成三版」我开始。',
  },
];

// 方案（步5 选项→实际给到创作系统提示）
export const A1_PLANS: Record<string, { key: string; label: string; note: string }> = {
  life: { key: 'life', label: '生活画面', note: '把此刻的真实，写成一条让人想停留的朋友圈' },
  attitude: { key: 'attitude', label: '个人态度', note: '把你坚持的东西，写成有态度、不喊口号的朋友圈' },
  contrast: { key: 'contrast', label: '分身反差', note: '让"数字的你"和"真实的你"反差对话' },
};

// 创作成功标准（用于 AI 判断草稿是否达到可发布）
export const A1_SUCCESS_CRITERIA = [
  '有画面感，读起来能"看见"一件事或一个瞬间',
  '是"你的"声音，不像通用模板',
  '只表达一个主题，不贪多',
  '忠于你的真实情况，不夸张',
];

// 大屏六格点亮时的文案（每格一句要问的话）
export const A1_BIGSCREEN_HINTS: string[] = [
  '你最希望数字的你替你做什么？',
  '先从小事做起——你想从哪个动作开始？',
  '我们一起画一张「数字的你」',
  '装上第一个 Skill：朋友圈表达',
  '挑一个方向，让分身开写',
  '一起写到最好',
];

export const A1_SUCCESS_STATE = 'iterated';
