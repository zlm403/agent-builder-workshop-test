// =========================================================
// 方案三 · 数字生命共生缸（grow_game）
// 配置层：所有文案 / 步骤 / 提示词集中在这里，改这里即可调整课程。
// 十阶段：空世界→特质→设计规则→AI翻译生成→投入共生缸→观察→修改→二次运行→过程卡→收束
// 核心：我提出想法 → AI帮我做成生命 → 放进真实运行的共生缸 → 我观察发现问题 → 判断并修改 → 我的创造真的变了
// =========================================================

export interface P3Stage {
  key: string; // s1..s10
  name: string; // 阶段名
  screenTitle: string; // 大屏显示的大标题
  screenQuestion: string; // 大屏显示的问题/任务
  studentTask: string; // 学生端任务说明
  action: string; // 学生端主要动作
  output: string; // 本阶段产出
  teacherHint: string; // 教师端提示
}

export const P3_STAGES: P3Stage[] = [
  {
    key: 's1',
    name: '空世界',
    screenTitle: '这个世界还没有居民',
    screenQuestion: '你想创造一个怎样的生命？它可以代表真实的你，也可以代表你想成为的某一部分。',
    studentTask: '看大屏：一个刚诞生的数字世界，有光、有能量，但没有生命。这些生命由你们创造。',
    action: '看大屏 + 开始',
    output: '创作动机',
    teacherHint: '不要讲玩法，先让世界空着，问"你想创造一个怎样的生命？"',
  },
  {
    key: 's2',
    name: '核心特质',
    screenTitle: '如果你的一种特质变成生命，它是什么？',
    screenQuestion: '不要把完整的自己都放进去，只选一个你想表达的特点。它是真实的你，还是你想成为的某部分？',
    studentTask: '选一个特质 + 写一句"为什么选它" + 选"它更接近：真实的我/想成为的自己"。',
    action: '选特质 + 填原因',
    output: '一句核心设定：我想创造一个____的生命',
    teacherHint: '不要逐项讲选项，学生自己选；"没有标准答案，只选最想放进世界的特点"。',
  },
  {
    key: 's3',
    name: '设计规则',
    screenTitle: '让一个想法变成可以运行的规则',
    screenQuestion: '说它勇敢、温柔或好奇，还不能让它活起来。替它作四个决定：怎么移动？遇到别人怎样？能做什么？付出什么代价？',
    studentTask: '生命设计卡：外形（形状/颜色/轨迹）、移动、相遇、能力、代价。每次只做一个选择。',
    action: '分步设计器',
    output: '一张完整的生命设计卡',
    teacherHint: '创作不只是说形容词，是把想法变成规则；"没有代价不能提交"。',
  },
  {
    key: 's4',
    name: 'AI 翻译生成',
    screenTitle: '想法正在变成生命',
    screenQuestion: '你提供的是想法和决定，让 AI 把它们翻译成一个可以运行的数字生命。',
    studentTask: '让 AI 把你的设计整理成生命规则（形象/移动/相遇/能力/代价），在小屏实验缸里试运行。',
    action: 'AI 翻译 + 试运行',
    output: '一版可运行的数字生命',
    teacherHint: '生成后不要只看好不好看，要检查是否实现了想法；可"主动试撞"看效果。',
  },
  {
    key: 's5',
    name: '投入共生缸',
    screenTitle: '共生缸开启',
    screenQuestion: '把生命放进全班共同的数字世界，观察它实际做了什么。',
    studentTask: '确认生命设计 → 投入共生缸（大屏）。投入后先不操作，先观察。',
    action: '投入',
    output: '第一次运行',
    teacherHint: '这是一处课堂高潮："刚才它只是你脑中的一个想法，现在进入了真实运行的世界。"',
  },
  {
    key: 's6',
    name: '观察',
    screenTitle: '它实际做了什么？',
    screenQuestion: '我原来希望____，但我现在看到____，我认为问题是____。',
    studentTask: '观察共生缸里自己的生命：移动/相遇/能力/能量；填写观察记录（看到的/认为的问题/为什么）。',
    action: '观察 + 填问题',
    output: '一个具体问题',
    teacherHint: '让世界自由运行 60-90 秒再停；不要替学生总结，问"你实际看到了什么"。',
  },
  {
    key: 's7',
    name: '修改',
    screenTitle: '不要问"怎样更酷"，先问"怎样更接近我的想法"',
    screenQuestion: '只改一个最关键的地方，并说清楚为什么改。',
    studentTask: '选择修改方向（移动/相遇/能力/代价/外形/触发条件）→ 让 AI 给两个方案 → 选一个。',
    action: '选方向 + AI方案 + 选择',
    output: '第二版生命',
    teacherHint: 'AI 输出两个可实现方案，学生必须作选择；"原目标/实际结果/修改"三行投屏示范。',
  },
  {
    key: 's8',
    name: '二次运行',
    screenTitle: '变化是否回应了你发现的问题',
    screenQuestion: '第一次运行 vs 第二次运行，对比修改前后。',
    studentTask: '看前后对比（相遇次数/能力触发/能量），选"更接近/解决一部分/没改善/新问题/第一版反而好"。',
    action: '对比 + 判断',
    output: '最终版本 + 一次基于结果的判断',
    teacherHint: '允许保留第一版；课程训练判断，不强制第二版更好。',
  },
  {
    key: 's9',
    name: '创造过程卡',
    screenTitle: '一个想法，是怎么变成生命的',
    screenQuestion: '我想创造一个____的生命；第一次运行时我发现____；所以我把____改成了____；最终我保留这个版本，因为____。',
    studentTask: '完成创造过程卡（自动带入已有内容，只需确认或补充）。',
    action: '填过程卡',
    output: '一张完整的个人创造过程卡',
    teacherHint: '带学生快速回看：一个想法→规则→生命→真实世界→发现问题→修改→新结果。',
  },
  {
    key: 's10',
    name: '认知收束',
    screenTitle: '有了想法，就能做出来',
    screenQuestion: '42 分钟前，这个世界里有生命吗？你们会写代码吗？现在，这个世界是谁创造出来的？',
    studentTask: '（一起看大屏）填结课句：今天我原本只有一个关于____的想法，后来借助 AI 把它做成了____。',
    action: '看大屏 + 结课句',
    output: '认知结论 + 结课句',
    teacherHint: '先指共生缸问"谁创造的世界"，再逐条揭示创造认知①②③，最后定格"有了想法，就能做出来"。',
  },
];

// P3 钩子开场
export const P3_HOOK = {
  eyebrow: '数字生命',
  title: '如果有一个东西，愿意陪你慢慢变好——',
  body1: '未来的自己、一个 AI 伙伴、一颗星球、一家小店……它不一定是活的，但你能看着它一点点长大。',
  body2: '今天，你来当导演：创造一个数字生命，把它放进全班共同的「共生缸」，看它真实地运行。',
  bridge: '你觉得这个好不好？好，那我们就真的来试一次——和 AI 一起，把你的数字生命做出来。',
};

// 目标横幅
export const P3_GOAL = {
  banner: '🎯 目标：创造一个数字生命，设计它的行为规则，把它放进共生缸运行——观察、发现问题、修改、再运行。',
};

// 核心特质选项
export const P3_TRAITS = [
  '喜欢探索',
  '先观察再行动',
  '主动连接别人',
  '愿意帮助别人',
  '遇到困难会坚持',
  '喜欢独立行动',
  '敢于尝试',
  '能适应变化',
  '自定义',
];

// 外形
export const P3_SHAPES = ['圆形', '星形', '水滴', '碎片', '环形', '自定义'];
export const P3_TRAILS = ['无', '微光', '波纹', '长尾', '粒子散落'];

// 移动规则
export const P3_MOVEMENTS = [
  { v: 'explore', label: '快速探索未知区域' },
  { v: 'observe', label: '缓慢移动并经常停下' },
  { v: 'follow-light', label: '跟随附近的光' },
  { v: 'avoid-crowd', label: '远离拥挤区域' },
  { v: 'approach-lonely', label: '靠近孤单的生命' },
  { v: 'edge', label: '沿世界边缘移动' },
  { v: 'custom', label: '自定义' },
];

// 相遇互动
export const P3_INTERACTIONS = [
  { v: 'approach', label: '主动靠近' },
  { v: 'keep-distance', label: '保持距离' },
  { v: 'orbit', label: '围绕对方旋转' },
  { v: 'follow', label: '跟随对方一段时间' },
  { v: 'exchange', label: '交换少量能量' },
  { v: 'change-color', label: '改变自己的颜色' },
  { v: 'pulse', label: '释放一圈光波' },
  { v: 'custom', label: '自定义' },
];

// 能力
export const P3_ABILITIES = [
  { v: 'light-up', label: '照亮附近区域' },
  { v: 'heal', label: '帮别人恢复能量' },
  { v: 'repel-danger', label: '推开危险事件' },
  { v: 'connect', label: '连接两个生命' },
  { v: 'reveal-hidden', label: '发现隐藏能量' },
  { v: 'leave-light', label: '在空旷区域留下光点' },
  { v: 'mimic', label: '暂时模仿另一个生命' },
  { v: 'custom', label: '自定义' },
];

// 代价
export const P3_COSTS = [
  { v: 'dim', label: '自己暂时变暗' },
  { v: 'slow', label: '移动速度降低' },
  { v: 'stop', label: '必须停止一段时间' },
  { v: 'drain', label: '消耗一部分能量' },
  { v: 'single', label: '只能影响一个生命' },
  { v: 'cooldown', label: '需要积累后才能再用' },
  { v: 'attract-events', label: '更容易吸引事件' },
  { v: 'custom', label: '自定义' },
];

// 生命默认设计
export const P3_DEFAULT_DESIGN = {
  trait: '',
  hue: 190,
  movement: 'explore',
  interaction: 'approach',
  ability: 'light-up',
  cost: 'dim',
  shape: 'circle',
  trail: 'glow',
  custom: [] as string[],
};

export const P3_SUCCESS_STATE = 'iterated';
