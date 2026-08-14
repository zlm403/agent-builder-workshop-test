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

// ---- A0 开场页（subState：a0:intro1 / a0:intro2 / a0:mirror）----
// 按新流程：P1 手指图(首次接触) → P2 二维发展图 → P3 三问 → P4 镜子"我们在哪儿？"
export const A0_INTRO = {
  // P1 手指图 · 首次接触 AI 的故事（不急着讲 AI，先让学生进入"我和 AI 第一次相遇"的个人记忆）
  intro1: {
    eyebrow: '开头',
    title: '我们和 AI 第一次相遇的瞬间',
    image: '/story/A0-1.jpg',
  },
  // P2 二维发展图 · 横轴时间 / 纵轴"人们开始用 AI 做什么"
  intro2: {
    eyebrow: '它走了多远',
    title: '从 ChatGPT-3.5 到今天，人们开始用 AI 做什么',
    body1: '每一段台阶，都代表一段"人们开始用它做什么"——越来越复杂、越来越向上。',
    image: '/ai-timeline.html', // 张老师自制图后替换（现为占位）
  },
  // P4 镜子 · "我们在哪儿？" 心理停顿
  mirror: {
    eyebrow: '停下来，看看自己',
    title: '我们在哪儿？',
    body1: 'AI 已经走到这里了——而你现在，站在哪一个位置？',
    body2: '你明明活在 2026 年，做的却还是 2023 年的事吗？',
  },
  // P8 收束 · "这个东西已经来了"（电子海啸图 + 三个视频）
  closing: {
    eyebrow: '回到现实',
    title: '这个东西，已经来了',
    body1: '就在我们身边，就在离我们不远处，有一个看不见的人工智能。不管我承认不承认，它就在身边，而且在不断地成长、不断地进化。',
    body2: '我们来看看，世界外面到底发生了什么事？',
    image: '/story/A0-2.jpg',
    videos: [
      { title: '罗振宇 · 从工具到伙伴', url: 'https://www.toutiao.com/article/7590932729160532522/' },
      { title: '腾讯 · 当"AI 是伙伴"不再只是一句口号', url: 'https://news.qq.com/rain/a/20260804A0EPJN00' },
      { title: '央视 · 智能伙伴 共创未来', url: 'https://tv.cctv.com/2026/07/17/VIDETtLXFMvBPhZOZhjjqzlN260717.shtml' },
    ],
  },
};

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

// 三问引导语（不提前透露"关系测试"，只当自然聊天收集真实使用行为）
export const A0_QUESTIONS_GUIDE =
  '不用想太多，就说说你平时到底怎么用 AI。没有对错，也没有标准答案。';

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
// ---- A0-3 学生滑杆（reveal:4，教师推送后学生手机上操作）----
export interface A0SliderStep {
  key: string;
  label: string; // 滑块上写的步骤名
  hint: string; // 小字说明（可空）
}

export const A0_SLIDER_STEPS: A0SliderStep[] = [
  { key: 'target', label: '目标定义', hint: '这件事谁先想清楚、谁来定' },
  { key: 'plan', label: '方案设计', hint: '怎么做、走哪条路' },
  { key: 'skill', label: '能力调动', hint: '靠谁的能力去完成' },
  { key: 'make', label: '执行创造', hint: '具体动手做出来' },
  { key: 'check', label: '结果验证', hint: '做成没做成，谁来判断' },
  { key: 'iterate', label: '迭代优化', hint: '下次怎么更好' },
];

export const A0_SLIDERS = {
  title: '在手机屏上，工具还是伙伴？', // 学生页标题栏
  leftLabel: '人', // 最左
  rightLabel: 'AI', // 最右
  submitText: '提交',
};

export const A0_REVEAL = {
  headline: '你和 AI，是「工具」还是「伙伴」？',
  // 三种形态 · 本质区别（打在大屏的工整对比表）
  formsTable: {
    title: '把 AI 当工具 vs 当伙伴，到底差在哪？',
    subtitle: '同样是做事，人的位置不一样',
    columns: ['过去', '现在', '未来'],
    rows: [
      { dim: '问题从哪来', cells: ['别人给', '自己发现', '人机共同发现'] },
      { dim: '目标谁定', cells: ['别人定', '我自己定', '人机共同定义价值'] },
      { dim: '能力靠谁', cells: ['人自己会', '人调用 AI 补足', '人机互为延伸'] },
      { dim: '判断谁做', cells: ['人自己做', '人判断、AI 提供依据', '共同判断、互相验证'] },
    ],
    punchline: {
      label: '一句话',
      cells: ['我解决问题', '我用 AI 解决问题', '我们一起创造'],
    },
  },
  // 工具 vs 伙伴 两张对比图（张老师画）：左=工具·单打独斗，右=伙伴·军团
  artImages: ['/story/A0-tool.png', '/story/A0-partner.png'],
};

// =========================================================
// A1 数字分身 · 六步（大屏 6 格 + 手机连续对话）
// 六步 = 未来流程六步：目标定义 → 方案设计 → 能力调动 → 执行创造 → 结果验证 → 迭代优化
// 核心任务 = 创造数字分身；发朋友圈是"人拿去检验分身"的手段
// =========================================================

export interface A1Step {
  key: string;
  name: string; // 大屏格子标题
  title: string; // 手机端当前阶段标题
  aiAsk: string; // AI 首次向学生发问的话（引导开场）
}

// A1 钩子开场（屏1 · 只显示一张孙悟空分身图，无文字）
export const A1_HOOK = {
  image: '/api/media/file/1786706693302-hi3j9o.png',
  alt: '孙悟空抱着手微笑，身后无数分身正在替他做事',
};

// 目标横幅（钩子讲完后钉在大屏顶部，全程不消失）
export const A1_GOAL = {
  banner: '🎯 目标：创造一个小小的数字分身，让它替我写一条朋友圈文案——看它做不做得到、写得像不像我。',
};

// A1 十七环节（任务链 1-12 + 升华链 13-17）
export interface A1Stage {
  key: string; // c1..c11
  name: string; // 阶段名
  screenTitle: string; // 大屏显示的大标题
  screenQuestion: string; // 大屏显示的问题/任务
  studentTask: string; // 学生端任务说明
  action: string; // 学生端主要动作
  output: string; // 本环节产出
  teacherHint: string; // 教师端提示
  media?: 'image' | 'video'; // 有则本屏只显示图/视频，无文字（image=留图位，video=留视频位）
  mediaUrl?: string; // image 的图片地址（教师/张老师给）
}

export const A1_STAGES: A1Stage[] = [
  // 屏3 · 发布任务
  {
    key: 'c1',
    name: '发布任务',
    screenTitle: '孙悟空拔一根毫毛，就能变出一个分身。我们今天当然不斩妖除魔，先做一件很小、但很真实的事：让一个数字的你，替你写一条朋友圈。看看它写不写得出来，更重要的是，写得像不像你。',
    screenQuestion: '',
    studentTask: '开始任务',
    action: '开始任务',
    output: '明确今天要做什么',
    teacherHint: '发布第一个真实任务：让数字的你写一条朋友圈。',
  },
  // 屏4 · AI沟通准则①（确定目标）
  {
    key: 'c2',
    name: 'AI沟通准则①',
    screenTitle: '和 AI 做事，先过这三关：①先别做，先确定目标；②让 AI 复述它的理解；③不一致就继续沟通，直到目标一致。',
    screenQuestion: '',
    studentTask: 'AI对话框；提示：先不要让它做，先确认目标。',
    action: '与 AI 对话，先确认目标',
    output: '目标对齐',
    teacherHint: '先不要让学生做，先学会确定目标。',
  },
  // 屏5 · 目标辨析
  {
    key: 'c3',
    name: '目标辨析',
    screenTitle: '我们到底要做什么？\n① 做一个数字分身（有对象，但不知道它先做什么）\n② 写一条朋友圈文案（有任务，但还不需要一个分身）\n③ 做一个会替我写朋友圈文案的数字分身（对象明确，第一项能力也明确）',
    screenQuestion: '',
    studentTask: '看大屏，并回到AI对话中确认目标',
    action: '看大屏 + 确认目标',
    output: '确认第三个目标',
    teacherHint: '三个目标不是递进，是并列；沟通时确定最正确的是③。',
  },
  // 屏6 · AI沟通准则②（确定怎么做）
  {
    key: 'c4',
    name: 'AI沟通准则②',
    screenTitle: '确定怎么做，先过这三关：①先问 AI：你准备怎么做？②告诉 AI：我手里有什么。③一起调整方法，直到能做。',
    screenQuestion: '',
    studentTask: '继续与AI对话；提示：先让它说方法，再告诉它你的条件。',
    action: '与 AI 对话，确定方法',
    output: '方法对齐',
    teacherHint: '先让它说方法，再告诉它你真实拥有的条件。',
  },
  // 屏7 · AI采访我
  {
    key: 'c5',
    name: 'AI采访我',
    screenTitle: 'AI采访我的时候，记住这四点：①不是所有问题都要回答；②每问一个问题，先说为什么要问；③不只是回答，要确认AI怎么理解；④AI的理解也要检查，不准确就继续纠正。',
    screenQuestion: '',
    studentTask: 'AI提问 → 判断是否相关 → 回答 → 要AI解释理解 → 检查、纠正',
    action: '回答 AI 采访',
    output: 'AI 认识真实的你',
    teacherHint: '让 AI 一个问题一个问题地采访，学生判断是否相关再回答。',
  },
  // 屏8 · 让分身开始工作
  {
    key: 'c6',
    name: '让分身开始工作',
    screenTitle: '接下来，给你和你的分身 5 分钟。\n① AI继续认识你，形成你的 Skill\n② 用 Skill 写一条朋友圈\n③ 看看像不像你\n④ 不像，就继续沟通、修改\n⑤ 满意后提交\n你不用一次做对，让它越来越像你。',
    screenQuestion: '',
    studentTask: '完整工作区：AI采访 → 形成/更新 Skill → 写朋友圈 → 判断 → 沟通修改 → 提交',
    action: '完整工作区，独立完成循环',
    output: '一条像你的朋友圈',
    teacherHint: '给学生和分身 5 分钟，独立完成整个训练循环。',
  },
  // 屏11 · 梦想①打开世界
  {
    key: 'c7',
    name: '梦想①打开世界',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看图，感受可能性',
    action: '看图',
    output: '万物皆可蒸馏的感受',
    teacherHint: '从"蒸馏自己"突然把梦想扩大到"万物"。',
    media: 'image',
    mediaUrl: '/api/media/file/1786707334547-chfj9g.png',
  },
  // 屏12 · 梦想②一个人与一支队伍
  {
    key: 'c8',
    name: '梦想②一个人与一支队伍',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看图',
    action: '看图',
    output: '强烈对比的感受',
    teacherHint: '把宏大的梦想落回"我自己"：一个人 vs 一支队伍。',
    media: 'image',
    mediaUrl: '/api/media/file/1786707336155-pi69mb.png',
  },
  // 屏13 · 现实：一人公司
  {
    key: 'c9',
    name: '现实：一人公司',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看案例',
    action: '看视频',
    output: '现实不是幻想',
    teacherHint: '放真实一人公司/AI创业案例视频（教师自己插视频）。',
    media: 'video',
  },
  // 屏14 · 现实信号
  {
    key: 'c10',
    name: '现实信号',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看材料',
    action: '看视频',
    output: '变化已进入真实社会',
    teacherHint: '放现实信号视频/材料（教师自己插）。',
    media: 'video',
  },
  // 屏15 · A1收束 → A2问题
  {
    key: 'c11',
    name: 'A1收束 → A2问题',
    screenTitle: '我们已经知道，AI时代，我们应该怎样和 AI 一起做事情。\n面对这个充满未知的世界，我们是要先学会了，再开始？\n还是……可以现在就开始？',
    screenQuestion: '',
    studentTask: '思考，进入 A2',
    action: '思考',
    output: '把问题悬在那里',
    teacherHint: '不给答案，把问题悬在那：我还不会，是不是也可以现在就开始？',
  },
];

// 每步沟通指导（大屏格子下方 + 学生屏顶部，学生照着发给 AI）
export const A1_GUIDES: string[] = [
  '告诉 AI：我想做一个数字分身，让它帮我生成朋友圈文案。就问它：这个梦想我该怎么做？',
  '问 AI：我要实现这个梦想，具体怎么做、做什么？',
  'AI 要正式开始了解你，认真回答它的每一个问题。',
  '对完话，AI 会根据你说的，生成一份属于你的 Skill 文件。找到它、加载它。',
  '让分身写一条朋友圈，你来检验：像不像你？做没做到？',
  '哪里不像，告诉它怎么改，再检验一次。',
];

export const A1_STEPS: A1Step[] = [
  {
    key: 'goal',
    name: '目标定义',
    title: '说出你的梦想：让分身替你写朋友圈',
    aiAsk:
      '假如可以创造一个「数字的你」，你最希望它替你做什么？\n\n比如：让它替你写朋友圈文案。你先说说你的想法是什么？',
  },
  {
    key: 'path',
    name: '方案设计',
    title: '和 AI 一起定下做法',
    aiAsk:
      '要实现这个梦想，我们按这个流程来：\n\n首先，我会问你几个问题，了解你；\n然后，你尽量告诉我你的情况；\n接着，我会根据我们的对话，形成一份 Skill 文件；\n最后，你把 Skill 加载好，以后直接告诉我发什么朋友圈，我就替你写。\n\n这个做法，你觉得可以吗？',
  },
  {
    key: 'build',
    name: '能力调动',
    title: 'AI 来认识你：一个问题一个问题地问',
    aiAsk:
      '好，那我们正式开始。要成为你的分身，我得先认识你。我会一个问题一个问题地问你，你想到什么就说什么。\n\n第一个问题：你是谁？你现在是做什么的，平时一天的节奏大概什么样？',
  },
  {
    key: 'make',
    name: '执行创造',
    title: '把「数字的你」做出来',
    aiAsk:
      '我已经足够了解你了。现在，我来根据我们刚才的对话，给你生成一份属于你的 Skill 文件。',
  },
  {
    key: 'check',
    name: '结果验证',
    title: '让分身写一条，你来检验',
    aiAsk:
      '你的数字分身做好了。现在考考它：告诉它你想发一条什么主题的朋友圈，看它写出来像不像你。',
  },
  {
    key: 'iterate',
    name: '迭代优化',
    title: '哪里不像，告诉它怎么改',
    aiAsk:
      '看看这一版，像你吗？哪里不像，直接告诉它怎么改；改完再看。满意了就提交。',
  },
];

// 方案（保留旧定义供兼容，新流程 check 步不再强制三选一方向）
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
  '先说出梦想：让分身替你做什么',
  '和 AI 定下做法',
  'AI 一个问题一个问题地了解你',
  '生成属于你的 Skill 文件',
  '让分身写一条，你来检验',
  '不像就改，改到像为止',
];

// A1 收官 · 做事认知对比图（三行旧认知 → 新认知）
export const A1_COG_COMPARE = {
  title: '做事的认知，已经悄悄变了',
  rows: [
    { old: '我要先学会很多东西，才能使用 AI', now: '我可以借助 AI，完成很多原本不会的事', from: '先学再用', to: '边做边学' },
    { old: 'AI 只是帮我回答问题的工具', now: '我和 AI 一起，共同完成一个目标', from: '用工具', to: '当伙伴' },
    { old: '我不会，所以做不了', now: '我先有梦想，就能和 AI 一起做出来', from: '被能力限制', to: '被目标驱动' },
  ],
  punchline: '过去先问「我会不会」；今天先问「我想做什么」。',
};

export const A1_SUCCESS_STATE = 'iterated';
