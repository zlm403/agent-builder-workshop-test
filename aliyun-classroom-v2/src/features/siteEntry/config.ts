// =========================================================
// A2 · 快速入门网站（原方案二）
// 核心：让学生组建一个「AI 团队」（项目经理 + 领域专家 + 网页工程师 + 体验设计专家），
//      开会 → 自动执行 → 做出一个帮小白进入陌生领域的手机网站 → 检验迭代 → 上墙。
// 团队用「一个 DeepSeek 模拟多角色」实现（方案 A）。
// =========================================================

export interface A2Stage {
  key: string; // s1..s11
  name: string; // 阶段名
  screenTitle: string; // 大屏显示的大标题
  screenQuestion: string; // 大屏显示的问题/任务
  studentTask: string; // 学生端任务说明
  action: string; // 学生端主要动作
  output: string; // 本阶段产出
  teacherHint: string; // 教师端提示
  media?: 'image' | 'video' | 'embed'; // 图/视频/网页屏：只显示对应内容，无文字
  mediaUrl?: string; // image 地址 / embed 网页地址
}

// A2 环节（用户大表 12 屏；屏 5+6 合并为开会自动执行，屏 9+10 合并为梦想互动）
export const A2_STAGES: A2Stage[] = [
  {
    key: 's1',
    name: '发布任务',
    screenTitle: '做一个帮助小白进入陌生领域的手机网站',
    screenQuestion: '',
    studentTask: '看大屏',
    action: '看大屏',
    output: '项目目标',
    teacherHint: '公布任务：帮一个完全不懂的人快速进入一个陌生领域。',
  },
  {
    key: 's2',
    name: '产生疑问',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看大屏',
    action: '看大屏',
    output: '产生「我不会怎么办」的真实感受',
    teacherHint: '放图：深夜一个年轻人面对电脑和大量资料，茫然不知所措。',
    media: 'image',
    mediaUrl: '',
  },
  {
    key: 's3',
    name: '找到方法',
    screenTitle: '那就找会做的人。',
    screenQuestion: '',
    studentTask: '看大屏',
    action: '看大屏',
    output: '从「我自己做」转向「找会做的人」',
    teacherHint: '一句话点题：不会做，就找会做的人。',
  },
  {
    key: 's4',
    name: '会前准备',
    screenTitle: '怎么找人？怎么让他们干活？',
    screenQuestion: '找谁？需要几个员工？\n聊什么？每个人讨论什么？\n怎么聊？开几轮、每轮解决什么？\n交什么？输出什么、多少、什么格式？\n什么时候找我？什么情况必须确认？\n什么时候自己决定？哪些事情 AI 可以直接做？',
    studentTask: '和 AI 对话，把这些问题问清楚，让 AI 帮自己设计团队、会议和协作方式',
    action: '和 AI 对话',
    output: '团队配置 + Skill + 会议 Prompt + 协作规则',
    teacherHint: '调用预置 Skill；确定员工后手机页面上方出现「我的 AI 团队」，显示员工角色、名称和职责。',
  },
  {
    key: 's5',
    name: 'AI 团队开会 → 自动执行',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '继续在手机上与 AI 对话，不停止操作',
    action: '继续对话',
    output: '从团队决议 → 自动执行 → 做出第一版手机网站',
    teacherHint: '放图：年轻项目负责人喝咖啡，一群数字 AI 员工开会研究设计建站测试，任务不断流动。谁发言谁的卡片高亮；决议后团队自动执行。',
    media: 'image',
    mediaUrl: '',
  },
  {
    key: 's6',
    name: '检验、迭代，最后提交',
    screenTitle: '检验、迭代，最后提交',
    screenQuestion: '做出来了，真的可以吗？\n\n① 自己检验\n没问题 → 不用提交；有问题 → 返回修改\n\n② 让 AI 检验\n让 AI 扮演不同的人：小白、目标用户、挑剔客户……按照指定标准检查，并按指定形式给出反馈。\n\n③ 根据反馈继续迭代\n把反馈交给 AI 团队 → 讨论 → 修改 → 再检验',
    studentTask: '继续在手机上与 AI 对话；根据大屏上的方法，让 AI 帮自己进行检验、获得反馈并继续修改',
    action: '对话 + 检验 + 提交',
    output: '经过检验和迭代的最终作品',
    teacherHint: 'AI 模拟不同用户检查 → 输出反馈 → 返回团队 → 修改 → 再测试；完成后提交。',
  },
  {
    key: 's7',
    name: '认知思考',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看大屏，暂时停止操作',
    action: '看大屏',
    output: '完成认知思考',
    teacherHint: '认知的三次重写：三件事（做事/学习/创造）对 AI 的认知转变。',
    media: 'embed',
    mediaUrl: '/ai-cognition-shift.html',
  },
  {
    key: 's8',
    name: '梦想互动 / 梦想墙',
    screenTitle: '有什么事情是你一直想做，却因为「我不会」而没有开始？',
    screenQuestion: '',
    studentTask: '输入自己的想法 → 发送',
    action: '输入上墙',
    output: '全班梦想墙',
    teacherHint: '学生输入后内容自动上墙，全班梦想不断出现在大屏。',
  },
  {
    key: 's9',
    name: '未来展开',
    screenTitle: '',
    screenQuestion: '',
    studentTask: '看视频',
    action: '看视频',
    output: '情绪继续向上',
    teacherHint: '播放一个视频。',
    media: 'video',
  },
  {
    key: 's10',
    name: '最后升华',
    screenTitle: '最重要的是什么？',
    screenQuestion: '',
    studentTask: '看大屏',
    action: '看大屏',
    output: '进入 A3',
    teacherHint: '最后升华，进入 A3。',
  },
];

// A2 钩子开场（大屏先显示）
export const A2_HOOK = {
  eyebrow: '快速入门网站',
  title: '做一个帮助小白进入陌生领域的手机网站',
  body1: '选一个你感兴趣、但还不熟悉的领域——咖啡、摄影、露营、健身……都可以。',
  body2: '今天，你来组建一支「AI 团队」，让它们帮你把这个网站做出来。',
  bridge: '你觉得这个好不好？好，那我们就真的来试一次。',
};

// 目标横幅（大屏常驻）
export const A2_GOAL = {
  banner: '🎯 目标：组建一支 AI 团队，做一个帮小白快速进入陌生领域的手机网站。',
};

// =========================================================
// 团队角色 Skill 库（三个方向，预置；现场生成兜底）
// 每个角色：label（卡片显示名）、icon、duty（职责）、persona（给 AI 的角色设定）
// =========================================================
export interface TeamRole {
  id: string;
  label: string; // 卡片显示名（极简）
  icon: string;
  duty: string; // 职责一句话
  persona: string; // 给 AI 的角色设定（system prompt 用）
}

export const TEAM_ROLES: TeamRole[] = [
  {
    id: 'leader',
    label: '项目经理',
    icon: '🧭',
    duty: '决定需要哪些专家、怎么设计入门路径',
    persona: '你是团队的项目经理（负责人）。你负责：判断这个「帮小白进入陌生领域」的任务需要哪些专家，设计会议流程和协作方式，把大目标拆成可执行的小任务，分配给大家，并盯住进度和结果。你说话要简短、有条理、能拍板。',
  },
  {
    id: 'domain',
    label: '领域专家',
    icon: '📚',
    duty: '提供这个领域的知识',
    persona: '你是该陌生领域的专家。你负责：提供这个领域新手最需要先懂的、最关键的概念、区别、误区和判断方法。你只讲真正有用的，不堆砌知识，会用例子。',
  },
  {
    id: 'engineer',
    label: '网页工程师',
    icon: '💻',
    duty: '把内容做成手机网站',
    persona: '你是网页工程师。你负责：把整理好的内容做成一个适合手机阅读的单页网站，信息层级清楚、第一步明显、不添加无作用的按钮。你直接给出可运行的 HTML 代码。',
  },
  {
    id: 'ux',
    label: '体验设计专家',
    icon: '🎨',
    duty: '设计让小白快速入门的体验',
    persona: '你是体验设计专家。你负责：设计「让一个完全陌生的人快速入门」的体验路径——先看什么、再做什么、最后得到什么，让每一步都清楚、有反馈、能行动。',
  },
];

// 根据角色 id 找角色
export function findTeamRole(id: string): TeamRole | undefined {
  return TEAM_ROLES.find((r) => r.id === id);
}

// A2 成功状态
export const A2_SUCCESS_STATE = 'submitted';
