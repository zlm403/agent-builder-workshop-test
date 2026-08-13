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
    body1: '从电脑屏幕里，出来了一个东西——那是我们第一次碰到它。',
    body2: '你还记得，你第一次用 AI 是什么时候吗？当时你在做什么？',
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

// A1 钩子开场（大屏先显示，不出现六格）
export const A1_HOOK = {
  eyebrow: 'A1 · 数字分身',
  title: '如果有「另一个你」，替你去干活——',
  body1: '孙悟空拔一根毫毛，变出另一个自己，替他斩妖除魔；那他本人呢？去花果山吃桃、玩耍。',
  body2: '如果我们也拥有一个「数字的你」，替你干活，你去吃喝玩乐——这个好不好？',
  bridge: '好，那我们先别空想。我们真的来试一次——和 AI 聊一聊，这件事到底怎么做。',
};

// 目标横幅（钩子讲完后钉在大屏顶部，全程不消失）
export const A1_GOAL = {
  banner: '🎯 目标：创造一个小小的数字分身，让它替我写一条朋友圈文案——看它做不做得到、写得像不像我。',
};

// A1 十七环节（任务链 1-12 + 升华链 13-17）
export interface A1Stage {
  key: string; // c1..c17
  name: string; // 阶段名
  screenTitle: string; // 大屏显示的大标题
  screenQuestion: string; // 大屏显示的问题/任务
  studentTask: string; // 学生端任务说明
  action: string; // 学生端主要动作
  output: string; // 本环节产出
  teacherHint: string; // 教师端提示
}

export const A1_STAGES: A1Stage[] = [
  // ---- 任务链 ----
  {
    key: 'c1',
    name: '发现问题',
    screenTitle: 'AI 写得很好，为什么我还是不想发？',
    screenQuestion: '大家有没有让 AI 帮你写过朋友圈、消息、文案？有没有"写得好，但不是我会说的话"的时候？',
    studentTask: '选一选：AI 写的内容最常见的问题是什么？（太正式/太夸张/太像广告/太有AI味/观点不是我的…）再写一句"AI 经常写、但你自己绝不会说"的话。',
    action: '选择题 + 写一句反例',
    output: '一个"不像我的表达"',
    teacherHint: '先让学生说"AI写得不像我"的真实感受，引出：问题不是 AI 不会写，是它还不认识你。',
  },
  {
    key: 'c2',
    name: '发布任务',
    screenTitle: '创造一个像你的 AI 分身',
    screenQuestion: '今天每个人都要创造一个自己的 AI 分身，让它替你写一条朋友圈——验收不是"写得好"，而是"写得像我"。',
    studentTask: '给分身起个名字（以后可以改）。',
    action: '起名',
    output: '分身项目',
    teacherHint: '公布任务三步：让AI认识你→让分身写朋友圈→不像就调整到"有点像我"。',
  },
  {
    key: 'c3',
    name: '选择真实任务',
    screenTitle: '这次朋友圈要写什么？',
    screenQuestion: '最近有什么事情，你本来可能会发一条朋友圈？事情要真实，内容不必重大。',
    studentTask: '填四个框：发生了什么？哪个细节最值得记录？真正想表达什么？希望别人看完什么感觉？',
    action: '填四框',
    output: '一份真实朋友圈任务卡',
    teacherHint: '强调事情真实、不编大主题，给判断"像不像"提供真实材料。',
  },
  {
    key: 'c4',
    name: 'AI 采访',
    screenTitle: '不要描述一个完美的你，要让 AI 认识真实的你',
    screenQuestion: '让 AI 来采访你，一次一个问题，说真实情况、尽量举例。',
    studentTask: '跟 AI 对话，回答它的采访（最近关注什么/怎么表达/不喜欢什么表达…）。',
    action: '对话（AI 采访）',
    output: '个人访谈记录',
    teacherHint: '提醒：说真实的我，不说理想中的自己；不要自己写长说明，让 AI 问。',
  },
  {
    key: 'c5',
    name: '补充真实样本',
    screenTitle: '你的原话，比你的自我评价更重要',
    screenQuestion: '粘贴一段你以前写过、很像自己的文字；再写一句你绝对不会说的话。',
    studentTask: '粘贴"像我"的文字 + 为什么像；写"绝不会说"的话 + 为什么不会。',
    action: '粘贴原话 + 反例',
    output: '一份正向样本 + 一条反向规则',
    teacherHint: '人对自己描述不一定准，让 AI 看你过去真的怎么说。可提醒隐去私人信息。',
  },
  {
    key: 'c6',
    name: '生成分身档案',
    screenTitle: 'AI 认识的你，真的是你吗？',
    screenQuestion: '让 AI 根据访谈和样本，整理第一版分身档案（我是谁/我关注什么/我怎么表达/我不怎么表达…）。',
    studentTask: '让 AI 整理成第一版分身档案，逐条看。',
    action: 'AI 生成档案',
    output: '第一版分身档案',
    teacherHint: '先不写朋友圈，先整理档案；档案不是答案，学生要负责审核。',
  },
  {
    key: 'c7',
    name: '校准档案',
    screenTitle: '分身不是一次生成的，是一次次纠正出来的',
    screenQuestion: '最像我的地方是什么？最不像我的地方是什么？还漏掉了什么？',
    studentTask: '三个必填框：最像我/最不像我(实际情况)/还应该补充；AI 据此修改档案。',
    action: '审核 + 让 AI 改',
    output: '修订后的分身档案',
    teacherHint: '这一步不是挑错，是塑造分身；找出三个：最像/最不像/最缺。',
  },
  {
    key: 'c8',
    name: '第一次写朋友圈',
    screenTitle: '不要选最好的一版，要选最像你的一版',
    screenQuestion: '让分身用你的档案，为真实事件写三条朋友圈（三版，风格不同但都像你）。',
    studentTask: '让 AI 用分身档案写三版朋友圈。',
    action: '生成三版',
    output: '第一轮三版文案',
    teacherHint: '三版不是挑最好看，是帮助比较哪版更像你。',
  },
  {
    key: 'c9',
    name: '判断像不像',
    screenTitle: '如果遮住名字，朋友会觉得是你写的吗？',
    screenQuestion: '三个版本里，哪一版最像你会说的话？具体哪个词不像？',
    studentTask: '对三版做判断（很像/有点/不太像/完全不像）+ 指出最像/最不像的一句 + 写"如果我自己说会怎么说"。',
    action: '四级判断 + 具体反馈',
    output: '具体修改意见',
    teacherHint: '反复强调：先别问写得好不好，先问像不像；找出一个具体位置。',
  },
  {
    key: 'c10',
    name: '调整',
    screenTitle: '说清楚哪里不像，AI 才知道怎样更像',
    screenQuestion: '把"不像"变成新的分身规则，让 AI 先总结理解，再重写。',
    studentTask: '系统带入反馈，让 AI 先用三句话总结修改方向，确认理解后再重写三版。',
    action: '反馈 → AI 总结 → 确认 → 重写',
    output: '第二轮三版 + 候选规则',
    teacherHint: '"不像"不是失败，是训练分身最有价值的材料；反馈要具体到词/句/分寸。',
  },
  {
    key: 'c11',
    name: '最终验收',
    screenTitle: '这次，有没有一句像你说的？',
    screenQuestion: '不用百分之百像，只看有没有一版或一句让你感觉"这好像是我会说的"。',
    studentTask: '选最终版本 + 写"最像我的一句" + 验收（很像/有点/还不太像/完全不像）。',
    action: '选版 + 验收',
    output: '一句"有点像我的话"',
    teacherHint: '"有点像我"就是成功；不像则给返回路径（补充信息/加样本/改规则）。',
  },
  {
    key: 'c12',
    name: '保存分身',
    screenTitle: '把今天确认过的"我"，交给未来的分身',
    screenQuestion: '把确认过的信息整理成能继续使用的最终分身档案，保存下来。',
    studentTask: '让 AI 整理最终分身档案（我是谁/关注什么/如何表达/不如何表达/规则/样本/禁用表达），保存。',
    action: '生成并保存分身档案',
    output: '一份可继续使用的分身（文件卡）',
    teacherHint: '保存 = 生成一份"分身文件"，之后还能继续用它。',
  },
  // ---- 升华链 ----
  {
    key: 'c13',
    name: '梦想',
    screenTitle: '如果它越来越了解你，它还能替你做什么？',
    screenQuestion: '两个梦想：① 我的分身还能帮我做什么？② 我能帮别人做分身吗？——帮马斯克、帮张老师、帮一本书、帮一个经验，everything 都可以变成分身。',
    studentTask: '（一起看大屏）想一想：我的分身还能做什么？万物皆可分身——我能为谁/为什么做分身？',
    action: '看大屏 + 想象',
    output: '个人应用清单',
    teacherHint: '先放大"我的分身还能做什么"，再放大"万物皆可分身"（人/抽象/书/经验/知识都能数据化）。',
  },
  {
    key: 'c14',
    name: '一个到一群',
    screenTitle: '如果你能拥有一支 AI 队伍，你最需要哪三个角色？',
    screenQuestion: '每个分身负责一件不同的事，你希望队伍里还有谁？',
    studentTask: '（一起看大屏）设计三个不同用途的分身：它负责什么、你负责什么。',
    action: '看大屏 + 设计队伍',
    output: 'AI 队伍雏形',
    teacherHint: '从一个分身扩展到多个：表达/整理/学习/创作/分析…',
  },
  {
    key: 'c15',
    name: '分析',
    screenTitle: '刚才为什么能做到？',
    screenQuestion: '谁提供方向？谁快速生成？谁负责判断？',
    studentTask: '（一起看大屏）回看：AI 一开始了解你吗？后来为什么更像？方向谁定？生成谁做？判断谁做？',
    action: '看大屏 + 回顾',
    output: '人机协作的理解',
    teacherHint: '从感性梦想转向理性分析：人=目标/材料/判断，AI=理解/生成/修改。',
  },
  {
    key: 'c16',
    name: '现实与紧迫',
    screenTitle: '当别人带着一支 AI 队伍工作时，你还准备只靠自己吗？',
    screenQuestion: '你更接近哪种使用 AI 的方式？今天之后最想先改变什么？',
    studentTask: '（一起看大屏）选一个：偶尔问/单项任务/多轮协作/已有分身。',
    action: '看大屏 + 判断题',
    output: '适度紧迫感',
    teacherHint: '先扬后抑，但落点不是"我要被淘汰"，而是"我也可以从今天开始建分身"。',
  },
  {
    key: 'c17',
    name: '结论',
    screenTitle: '一个人，就是一支队伍',
    screenQuestion: '过去：一个人只有一个人的能力。现在：一个人可以带着一群 AI 做事。',
    studentTask: '（一起看大屏）完成认知确认卡：以前我以为 AI 是___；刚才我发现 AI 可以___；接下来我想创造的第二个分身是___。',
    action: '看大屏 + 结课卡',
    output: '个人结课卡',
    teacherHint: '逐条揭示三条做事认知，最后共同总结"一个人，就是一支队伍"。',
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
