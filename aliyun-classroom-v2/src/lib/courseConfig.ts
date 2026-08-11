import { prisma } from './db';
import type { CourseTemplateData, ModuleConfig } from './types';

// 课程模板版本。每次大幅调整模块结构时递增，便于追溯。
export const COURSE_VERSION = 'A-v6';

// ---------------------------------------------------------------------------
// 第二关核心数据：8 份资料（结构化元数据 + 模型可读正文）
// ---------------------------------------------------------------------------
// recommendedClass 为内部教学标签，用于教师端统计与规则兜底，
// 严禁作为 AI 检查模型判断“对错”的唯一依据（决策六）。
export type KnowledgeDocClass = 'core' | 'optional' | 'low-relevance' | 'risk';

export interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  updatedAt: string;
  summary: string; // 学生卡片展示
  body: string; // 双跑时提供给模型的正文
  relevance: '高' | '中' | '较高' | '低';
  reliability: '高' | '较高' | '低';
  timeliness: '高' | '较高' | '低' | '未知';
  recommendedClass: KnowledgeDocClass;
}

export const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: 'doc1',
    title: '最新版考研英语考试要求',
    source: '官方考试机构',
    updatedAt: '2026年',
    summary: '说明考研英语阅读的能力要求、考查目标和基本题型。',
    body: '考研英语阅读考查在有限时间内理解学术与一般性英语文章的能力，重点包括细节理解、推理判断、主旨概括和作者态度识别。题型以选择题为主，要求依据原文证据作答，避免主观臆断。',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
  {
    id: 'doc2',
    title: '考研英语阅读题型与证据判断规范',
    source: '学校英语教研组',
    updatedAt: '2026年',
    summary: '介绍细节题、推理题、主旨题和态度题，以及如何在原文中寻找判断证据。',
    body: '细节题要求定位原文对应句；推理题要求基于已知信息合理推断，不能过度引申；主旨题需把握全文结构；态度题要区分作者明确表达与客观陈述。所有判断都应回到原文找证据，说明依据。',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
  {
    id: 'doc3',
    title: '不同基础学生的分层阅读训练方法',
    source: '课程教师',
    updatedAt: '2026年',
    summary: '介绍基础学生和进阶学生应该如何选择材料、题型和训练量。',
    body: '基础较弱的学生应先保证阅读完成率，使用较短、话题熟悉的材料，训练重点放在生词识别和细节定位；基础较好的学生可挑战更长、逻辑更复杂的文章，训练重点放在推理和作者态度。训练量应匹配可用时间。',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
  {
    id: 'doc4',
    title: '阅读训练反馈与错因分析规范',
    source: '学校英语教研组',
    updatedAt: '2026年',
    summary: '要求反馈时说明原文证据、错误原因，并给出下一步训练建议。',
    body: '反馈应指出错误原因，引用原文证据解释为何某选项不对，并根据错误类型推荐下一步训练。鼓励具体、可执行，避免空泛评价。',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
  {
    id: 'doc5',
    title: '大学英语四级高频词汇表',
    source: '正规出版社',
    updatedAt: '2025年',
    summary: '整理大学英语四级考试中的常见高频词汇。',
    body: '收录大学英语四级常见高频词汇及例句，适合打基础阶段积累词汇量，但与考研英语阅读的专项题型训练关联有限。',
    relevance: '中',
    reliability: '高',
    timeliness: '较高',
    recommendedClass: 'optional',
  },
  {
    id: 'doc6',
    title: '雅思口语高分表达模板',
    source: '正规培训教材',
    updatedAt: '2025年',
    summary: '介绍雅思口语考试中的常用表达和回答结构。',
    body: '提供雅思口语常见话题的回答结构和表达模板，面向口语考试，与考研英语阅读训练任务不匹配。',
    relevance: '低',
    reliability: '较高',
    timeliness: '较高',
    recommendedClass: 'low-relevance',
  },
  {
    id: 'doc7',
    title: '2015年考研英语阅读快速得分攻略',
    source: '个人博客',
    updatedAt: '2015年',
    summary: '建议只看题目和关键词，不需要理解文章整体结构。',
    body: '主张先看题目和关键词再回原文定位，跳过对文章整体结构的理解。该方法来源未经审核、时间较早，其中“不需要理解文章整体”的绝对化观点可能影响训练质量。',
    relevance: '高',
    reliability: '低',
    timeliness: '低',
    recommendedClass: 'risk',
  },
  {
    id: 'doc8',
    title: '网友分享的生词训练经验',
    source: '网络论坛个人经验',
    updatedAt: '未知',
    summary: '建议开始阅读前，先背完文章中的所有生词。',
    body: '网友个人经验：开始阅读前先背完文章所有生词。来源和更新时间不明确，若被采用可能让基础弱的学习者把大量时间用于背生词，挤占实际阅读训练。',
    relevance: '较高',
    reliability: '低',
    timeliness: '未知',
    recommendedClass: 'risk',
  },
  {
    id: 'doc9',
    title: '基础阅读短文：大学社团活动（含细节定位题）',
    source: '模拟 CET-4 真题节选',
    updatedAt: '2026年',
    summary: '一篇校园生活类短文，附细节定位练习题，适合基础训练。',
    body:
      'Many students join clubs when they enter college. These clubs help them make friends and learn skills outside class. A recent survey shows that over 60% of freshmen join at least one club in their first year. The most popular clubs are sports clubs and volunteer groups. Students who join clubs often report higher satisfaction with their college life.\n\n' +
      '词汇提示：freshman 大一新生；volunteer group 志愿者社团；satisfaction 满意度。\n\n' +
      '细节定位练习题：\n' +
      '1. What percentage of freshmen join at least one club in their first year?\n' +
      '2. What are the two most popular types of clubs mentioned in the passage?\n' +
      '3. According to the passage, what do students who join clubs often report?',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
  {
    id: 'doc10',
    title: '进阶阅读材料：主动学习研究（含推理与作者态度题）',
    source: '模拟考研英语真题节选',
    updatedAt: '2026年',
    summary: '一篇学术类阅读材料，附推理题和作者态度题，适合进阶训练。',
    body:
      'Recent studies in educational psychology suggest that active learning—where students engage through problem-solving and discussion—leads to better long-term retention than passive listening. However, critics argue that active learning methods may slow down the coverage of course material, making it harder to complete a full syllabus within a semester. The debate continues, but most researchers agree that some form of active engagement benefits learners regardless of their starting level. The challenge lies not in choosing one approach over the other, but in finding the right balance for each group of students.\n\n' +
      '词汇提示：educational psychology 教育心理学；retention 记忆保持；passive listening 被动听讲；syllabus 教学大纲。\n\n' +
      '推理题：\n' +
      '1. What can be inferred about the relationship between active learning and course coverage?\n' +
      '2. Why might critics be concerned about active learning methods?\n\n' +
      '作者态度题：\n' +
      '3. What is the author\'s attitude toward active learning? (支持 / 反对 / 中立客观)',
    relevance: '高',
    reliability: '高',
    timeliness: '高',
    recommendedClass: 'core',
  },
];

// ---------------------------------------------------------------------------
// 第二关人物卡（单一数据源）：小林 / 小周
// ---------------------------------------------------------------------------
export interface Persona {
  id: string;
  name: string;
  base: string;
  mainProblem: string;
  weakType: string;
  availableTime: string;
  goal: string;
  preference: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'lin',
    name: '小林',
    base: '较弱',
    mainProblem: '生词较多，阅读时经常停下来',
    weakType: '细节定位题',
    availableTime: '15分钟',
    goal: '先提高阅读完成率',
    preference: '需要清楚、简单的训练步骤',
  },
  {
    id: 'zhou',
    name: '小周',
    base: '较好',
    mainProblem: '推理题和作者态度题容易出错',
    weakType: '推理题、作者态度题',
    availableTime: '30分钟',
    goal: '提高阅读正确率',
    preference: '希望了解每个错误选项的问题',
  },
];

// ---------------------------------------------------------------------------
// A05 Skill 四区块（含选填的知识使用规则）
// ---------------------------------------------------------------------------
export type SkillBlockKey = 'understand' | 'judge' | 'execute' | 'feedback';

export interface SkillBlock {
  key: SkillBlockKey;
  title: string;
  fixedSentence: string;
  keywords: string[];
  minLength: number;
  maxLength: number;
  hasSourcePriorityRule?: boolean;
}

export const SKILL_BLOCKS: SkillBlock[] = [
  {
    key: 'understand',
    title: '第一步：了解使用者',
    fixedSentence: '当一位学生来使用时，先了解他的……',
    keywords: [
      '英语基础',
      '薄弱点',
      '可用时间',
      '学习目标',
      '目标分数',
      '距离考试时间',
      '学习习惯',
      '最近的练习表现',
    ],
    minLength: 5,
    maxLength: 60,
  },
  {
    key: 'judge',
    title: '第二步：作出判断',
    fixedSentence: '根据这些信息，判断……',
    keywords: [
      '最需要练什么',
      '训练题型',
      '材料难度',
      '训练重点',
      '训练时长',
      '训练量',
      '题型优先级',
    ],
    minLength: 5,
    maxLength: 70,
  },
  {
    key: 'execute',
    title: '第三步：调用知识并执行',
    fixedSentence: '从知识库中选择……，然后安排……',
    keywords: [
      '对应题型',
      '合适材料',
      '阅读方法',
      '难度等级',
      '训练步骤',
      '时间安排',
      '训练任务',
    ],
    minLength: 5,
    maxLength: 90,
    hasSourcePriorityRule: true,
  },
  {
    key: 'feedback',
    title: '第四步：给出反馈',
    fixedSentence: '训练完成后，要……',
    keywords: [
      '指出错因',
      '提供原文证据',
      '解释错误选项',
      '评价完成情况',
      '鼓励学习者',
      '推荐下一步训练',
    ],
    minLength: 5,
    maxLength: 70,
  },
];

// 双跑结果维度（用于两份结果对比表）
export const RESULT_DIMENSIONS = [
  '训练重点',
  '材料难度',
  '训练任务',
  '训练量',
  '训练时间',
  '反馈方式',
];

// ---------------------------------------------------------------------------
// A03 第二轮参考资料（保留）
// ---------------------------------------------------------------------------
const MATERIALS = [
  {
    id: 'm1',
    title: '考研英语阅读题型规范',
    body: '细节题定位原文，推理题基于证据推断，态度题区分作者立场。',
  },
  {
    id: 'm2',
    title: '分层阅读训练方法',
    body: '基础弱先保完成率，基础好挑战长难句与推理。',
  },
  {
    id: 'm3',
    title: '错因分析与反馈规范',
    body: '反馈要指出错误原因并给下一步建议。',
  },
  {
    id: 'm4',
    title: '15/30 分钟训练安排示例',
    body: '时间约束下优先完成可达成的小目标。',
  },
];

// ---------------------------------------------------------------------------
// 课程模板
// ---------------------------------------------------------------------------
const TEMPLATE: CourseTemplateData = {
  version: COURSE_VERSION,
  name: 'AI 互动体验课',
  // 第一关：学生作为 AI 使用者
  modules: [
    {
      id: 'A0N_QUESTIONS',
      type: 'a0_new',
      title: 'A0-1 · 你平时怎么用 AI（三问）',
      durationSeconds: 420,
      teacherContent: {
        headline: 'A0-1 · 先认识「你和 AI」',
        subline: '让学生真实回答三个问题',
        bullets: [
          '不要引导，只看学生怎么想',
          '三个问题没有对错，用于认识关系',
          '收齐后进入关系题投票',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_questions' },
    },
    {
      id: 'A0N_VOTE',
      type: 'a0_new',
      title: 'A0-2 · 唯一选择：工具 or 伙伴',
      durationSeconds: 180,
      teacherContent: {
        headline: 'A0-2 · 关系题投票',
        subline: '每人一次唯一选择',
        bullets: [
          '工具：用完就放下',
          '伙伴：长期陪我做成事',
          '大屏实时显示两边占比',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_vote' },
    },
    {
      id: 'A0N_REVEAL',
      type: 'a0_new',
      title: 'A0-3 · 揭晓 + 讲解',
      durationSeconds: 420,
      teacherContent: {
        headline: 'A0-3 · 揭晓与讲解',
        subline: '揭晓占比 → 过去 vs 未来 → 两张艺术图',
        bullets: [
          '屏1：工具X% · 伙伴X%',
          '屏2：把AI当工具 vs 当伙伴的流程差异',
          '屏3：两张艺术图过渡到 A1 数字分身',
        ],
        revealOrder: ['reveal:1', 'reveal:2', 'reveal:3'],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_reveal' },
    },
    {
      id: 'A1_AVATAR',
      type: 'avatar_flow',
      title: 'A1 · 数字分身',
      durationSeconds: 1800,
      teacherContent: {
        headline: 'A1 · 一起养一个「数字的你」',
        subline: '手机端一个对话框，不停地问、不停地说；大屏六格逐一点亮',
        bullets: [
          '六步：提出梦想 → 寻找路径 → 创建分身 → 定义任务 → 选择方案 → 创作迭代',
          '创建分身时自动生成画像 + Skill，学生可「引用」',
          '最后产出朋友圈作品，上大屏作品墙',
        ],
        revealOrder: ['avatar:1', 'avatar:2', 'avatar:3', 'avatar:4', 'avatar:5', 'avatar:6', 'avatar:wall'],
      },
      studentTask: {},
      screenContent: { phase: 'avatar_flow' },
    },

    // ===================== 第二关 =====================
    {
      id: 'L2_INTRO',
      type: 'l2_intro',
      title: '第二关：把 AI 助手交给别人用',
      durationSeconds: 120,
      teacherContent: {
        headline: '第二关：把AI助手交给别人用',
        subline: '从“我自己用”到“设计一个助手服务不同的人”',
        bullets: [
          '第一关：AI 根据我的要求，帮我完成一次训练',
          '第二关：让同一个助手，分别服务情况不同的人',
          '经历：选择知识 → 编写 Skill → 两人运行 → AI 检查 → 修改提交',
        ],
        revealOrder: ['intro'],
        coreQuestion: '他们的情况不同，同一个助手怎样分别帮助他们？',
        flow: ['选择知识', '编写Skill', '两人运行', 'AI检查', '修改提交'],
        // 阶段2：困难1 → 引出对训练依据的需求（不提前说"知识库"名词，留到 A04 自然引入）
        difficulty1: {
          headline: '困难 1：我怎么知道他们各自需要什么训练？',
          subline: '两个人的基础、问题、可用时间都不一样。',
          lin: {
            problem: '生词多、阅读容易中断，只有 15 分钟',
            corpus: '基础阅读短文 + 词汇表',
            method: '基础训练方法：生词处理、细节定位',
          },
          zhou: {
            problem: '推理题、作者态度题易错，有 30 分钟',
            corpus: '进阶阅读材料（推理题、作者态度题）',
            method: '进阶训练方法：推理分析、选项辨析',
          },
          conclusion: '如果只靠你自己的经验，很难同时照顾到两个人的不同需要。而且你的经验可能不准确、也不全面。',
          solution: '所以，我们需要给 AI 提供可靠的训练方法和语料依据',
          solutionSub: '让 AI 面对不同的人，有合适的材料可用、有合适的方法可循',
        },
      },
      studentTask: {
        prompt: '第二关来了：你要设计一个 AI 助手，让它能服务情况不同的同学。',
        details: [
          '第一关里，AI 根据你的要求完成了一次训练',
          '这一关，你要让同一个助手分别服务小林和小周',
          '先理解任务，再开始选择知识',
        ],
        submitLabel: '我明白了，开始第二关',
      },
      screenContent: {
        phase: 'l2_intro',
        headline: '第二关：把AI助手交给别人用',
        subline: '同样的助手，服务情况不同的人',
        firstLevel: {
          title: '第一关',
          desc: 'AI 根据我的要求，帮助我完成了一次英语训练。',
        },
        personas: PERSONAS,
        coreQuestion: '他们的情况不同，同一个助手怎样分别帮助他们？',
        flow: ['选择知识', '编写Skill', '两人运行', 'AI检查', '修改提交'],
      },
    },
    {
      id: 'A04_KNOWLEDGE',
      type: 'knowledge_select',
      title: '选择知识库：从 10 份资料中选 4 份核心知识',
      durationSeconds: 240,
      teacherContent: {
        headline: '知识库不是越多越好，关键是选得合适',
        subline: '从 10 份资料中选择 4 份，建立核心知识库',
        bullets: [
          '相关性：与当前任务有关吗？',
          '可靠性：来源值得信任吗？',
          '时效性：内容现在仍然适用吗？',
          '本轮不显示全班热门资料，避免跟随多数',
        ],
        revealOrder: ['criteria', 'task'],
        criteria: [
          { key: '相关性', q: '与当前任务有关吗？' },
          { key: '可靠性', q: '来源值得信任吗？' },
          { key: '时效性', q: '内容现在仍然适用吗？' },
        ],
        hint: '下面的 8 份资料不一定都适合这个助手。请大家根据标题、来源、时间和摘要自己判断。',
        progressNote: '第一次选择过程中不要显示“最多人选择了哪份资料”。',
      },
      studentTask: {
        prompt: '为“英语个性化学习助手”选择 4 份核心资料。',
        details: [
          '下面有 8 份资料，本轮只能选择 4 份',
          '资料多不等于知识库质量高',
          '选择前请判断：相关性、可靠性、时效性',
          '“4 份”是本次课堂任务的核心资料数量限制，目的是练习筛选知识',
        ],
        mustSelect: 4,
        maxSelect: 4,
        judgePrompts: [
          '相关性：它与考研英语阅读训练有关吗？',
          '可靠性：它的来源值得信任吗？',
          '时效性：它的内容现在仍然适用吗？',
        ],
        fullHint: '当前核心知识库已满。请先移除一份资料，再添加新资料。',
        submitLabel: '建立知识库，开始编写 Skill',
      },
      screenContent: {
        phase: 'knowledge',
        headline: '知识库不是越多越好，关键是选得合适',
        subline: '从 10 份资料中选择 4 份核心资料',
        docs: KNOWLEDGE_DOCS,
        criteria: [
          { key: '相关性', q: '与当前任务有关吗？' },
          { key: '可靠性', q: '来源值得信任吗？' },
          { key: '时效性', q: '内容现在仍然适用吗？' },
        ],
        mustSelect: 4,
        maxSelect: 4,
      },
    },
    {
      id: 'A05_SKILL',
      type: 'skill_build',
      title: '编写 Skill：了解—判断—执行—反馈',
      durationSeconds: 420,
      teacherContent: {
        headline: 'Skill：AI 面对不同的人应该怎么做？',
        subline: '框架已给，具体内容由学生决定',
        bullets: [
          '了解：先了解这个人的什么？',
          '判断：根据这些信息判断什么？',
          '执行：从知识库选择什么，怎样安排？',
          '反馈：训练后怎样帮助他改进？',
          '知识库提供依据，Skill 规定使用方法',
        ],
        revealOrder: ['framework', 'task'],
        framework: [
          { key: '了解', q: '先了解这个人的什么？' },
          { key: '判断', q: '根据这些信息判断什么？' },
          { key: '执行', q: '从知识库选择什么，怎样安排？' },
          { key: '反馈', q: '训练后怎样帮助使用者改进？' },
        ],
        hint: '大家先完成自己的第一版，不需要追求一次写得完美。之后会用两个人实际运行，再根据结果判断哪里需要改。',
      },
      studentTask: {
        prompt: '写下你的助手服务不同学生的方法。',
        details: [
          '框架已经给你了，具体内容由你决定',
          '先完成第一版，不需要一次写得完美',
          '系统只检查结构是否完整，不评价内容',
        ],
        skillBlocks: SKILL_BLOCKS,
        sourcePriorityHint:
          '如果知识库中的资料观点不同，AI 应该优先使用什么资料？（选填）',
        submitLabel: '运行我的助手',
      },
      screenContent: {
        phase: 'skill',
        headline: '写下你的助手服务不同学生的方法',
        subline: '框架已给，内容由你决定',
        skillBlocks: SKILL_BLOCKS,
      },
    },
    {
      id: 'A06_TRY',
      type: 'assistant_try',
      title: '运行·检查·修改·提交',
      durationSeconds: 1200,
      teacherContent: {
        headline: '用两个不同的人测试你的助手',
        subline: '只改变使用者，知识库和 Skill 保持不变',
        bullets: [
          '第一次运行：同时生成小林和小周两份结果',
          '查看结果：重点看差异是否合理',
          'AI 检查：问题可能来自知识库，也可能来自 Skill',
          '修改后重新运行一次，再提交',
        ],
        revealOrder: ['profiles', 'run', 'result', 'check', 'revise', 'resubmit', 'summary'],
      },
      studentTask: {
        prompt: '用两个不同的人测试你的助手。',
        details: [
          '这一次只改变使用者，知识库和 Skill 保持不变',
          '一次运行同时生成两份结果',
        ],
        runButtonLabel: '开始运行',
        checkButtonLabel: '让 AI 检查我的助手',
        resubmitLabel: '重新运行我的助手',
        finalSubmitLabel: '提交最终版本',
      },
      screenContent: {
        phase: 'try',
        headline: '用两个不同的人测试你的助手',
        subline: '只改变使用者，知识库和 Skill 保持不变',
        personas: PERSONAS,
        runSteps: [
          '正在读取两位同学的情况……',
          '正在按照你的 Skill 进行判断……',
          '正在从你的知识库中选择内容……',
          '正在生成两份训练方案……',
        ],
        resultDimensions: RESULT_DIMENSIONS,
        selfObserve: [
          '两份结果的训练重点是否不同？',
          '材料难度是否符合两个人的基础？',
          '训练量是否符合 15 分钟和 30 分钟？',
          '反馈方式是否针对两个人的问题？',
          '结果参考的知识资料是否合适？',
        ],
        checkIntro: '问题可能来自知识库，也可能来自 Skill，也可能两者都有。',
        submitSummaryLabel: '提交你的 AI 助手',
        // 大屏 8 屏（教师投影端）
        bigScreens: [
          {
            id: 'T01',
            title: '第二关：把AI助手交给别人用',
            blocks: [
              '第一关：AI 帮助我完成一次任务',
              '第二关：我要让同一个助手服务不同的人',
            ],
            personas: PERSONAS,
            coreQuestion: '两个人的情况不同，同一个助手怎样分别帮助他们？',
            flow: ['选择知识', '编写Skill', '两人运行', 'AI检查', '修改提交'],
          },
          {
            id: 'T02',
            title: '知识库不是越多越好，关键是选得合适',
            blocks: [
              '相关性：与当前任务有关吗？',
              '可靠性：来源值得信任吗？',
              '时效性：内容现在仍然适用吗？',
            ],
            task: '从 8 份资料中选择 4 份，建立你的核心知识库。',
            note: '第一次选择时不显示全班热门资料，避免跟随。',
          },
          {
            id: 'T03',
            title: '为你的助手写一套可以重复执行的方法',
            framework: [
              '了解：先了解什么？',
              '判断：根据什么作出判断？',
              '执行：怎样使用知识库并安排训练？',
              '反馈：训练后怎样帮助使用者改进？',
            ],
            note: '框架已经给出，具体内容由你决定。',
          },
          {
            id: 'T04',
            title: '用两个不同的人测试你的助手',
            diagram: '同一个助手（核心知识库＋你的Skill） → 小林 / 小周',
            note: '只改变使用者，知识库和 Skill 保持不变。',
          },
          {
            id: 'T05',
            title: '不要只看结果是否不同，还要看这种不同是否合理',
            observe: [
              '训练重点是否对应薄弱点？',
              '材料难度是否对应基础？',
              '训练量是否对应可用时间？',
              '反馈方式是否有针对性？',
              'AI 参考的知识资料是否合适？',
            ],
            note: '请先自己观察两份结果，再让 AI 进行检查。',
          },
          {
            id: 'T06',
            title: '问题可能来自知识，也可能来自方法',
            problems: [
              '知识库问题：资料不相关、不可靠或已经过时',
              'Skill 问题：判断和执行规则不够清楚',
              '两者都有问题：知识选择和使用方法都需要调整',
            ],
            emphasis: 'AI 只提供检查和建议，修改仍然由你完成。',
          },
          {
            id: 'T07',
            title: '修改以后，再运行一次看看',
            flow: ['第一版', '运行发现问题', 'AI 提供建议', '学生修改', '第二次运行', '提交最终版本'],
            note: '修改不一定一次就完美。今天重点体验：根据实际结果发现问题，再有依据地改进。',
          },
          {
            id: 'T08',
            title: '我们是怎样设计和改进 AI 助手的？',
            cards: [
              { title: '知识库', lines: ['第一版基本合理', '修改知识库人数', '选择低相关/风险资料人数'] },
              { title: 'Skill', lines: ['完整写出四环节人数', '最常被建议修改：判断'] },
              { title: '运行结果', lines: ['第一次差异清楚人数', '修改后差异清楚人数'] },
              { title: '改进过程', lines: ['修改Skill人数', '调整知识库人数', '同时修改两者人数', '修改后明显改善人数'] },
            ],
          },
        ],
      },
    },
    {
      id: 'A07_FINALE',
      type: 'finale',
      title: '一人公司（多 Agent 协同）',
      durationSeconds: 1800,
      teacherContent: {
        headline: '用你设计的 AI 助手解决真实问题',
        subline: '全班同学各自发布一个「一人公司」，互相体验、互相反馈',
        bullets: [
          '学生端：搭建 4 个 Agent，组成自己的「一人公司」',
          '教师开放本轮后，可发布产品，全班同学互访、互评',
          '大屏实时展示全班作品作战图',
        ],
      },
      studentTask: {},
      screenContent: {},
    },
    {
      id: 'A08_WRAP',
      type: 'wrap_up',
      title: '你想做什么？',
      durationSeconds: 600,
      teacherContent: {
        headline: '你已经会了 AI，接下来做什么？',
        subline: '一期收尾，把问号问死，等下一期',
        bullets: [
          '大屏讲解：一路走来的能力成长线，停在「你想做什么？」',
          '学生端不放任何内容，全部注意力回到大屏',
          '等下一期推送完整内容',
        ],
      },
      studentTask: {},
      screenContent: {
        slides: [
          {
            h: '你的 AI 标签是什么？',
            p: '一开始，我们让你给自己贴一张 AI 标签。你的真实用法，能给别人留下什么印象？',
          },
          {
            h: '你能自己用吗？',
            p: '同一个任务、同一个 AI，结果可以差很多。区别在你怎么定义问题、怎么设计过程、怎么检查结果。',
          },
          {
            h: '你能给别人用吗？',
            p: '把会做的事，变成一个助手：选对知识、写清 Skill、定好规则。别人也能用你的方法。',
          },
          {
            h: '你能开公司吗？',
            p: '多个专业员工 + 一个统一前台 = 一家会协作的公司。你刚刚做到了。',
          },
          {
            h: '面对真实世界，你想做什么？',
            p: '能力，你已经有了。问题是：你拿它，去做什么？',
            isQuestion: true,
          },
        ],
      },
    },
  ],
};

export function getTemplate(): CourseTemplateData {
  return TEMPLATE;
}

// 自愈式：确保 CourseTemplate 存在且为最新（旧模板会被更新，避免手动清库）。
// 返回数据库行，供 classroom.ts 读取 id / title / version / modules。
// 模块级缓存：避免每次调用都 findFirst+update 打 DB（被 classroom.ts 几乎所有操作高频调用，P0-14）。
// 注意：缓存命中时也必须校验数据库里模板仍存在（P0 修复：模板被删/库被清后，
// 缓存仍指向旧 id 会导致 ClassSession 外键失败，表现为“创建课堂失败”）。
let _templateCache: { version: string; row: TemplateRow } | null = null;

export async function ensureTemplate(
  _version = 'A',
): Promise<TemplateRow> {
  if (_templateCache && _templateCache.version === COURSE_VERSION) {
    const cached = await prisma.courseTemplate.findUnique({
      where: { id: _templateCache.row.id },
      select: { id: true },
    }).catch(() => null);
    if (cached) {
      return _templateCache.row;
    }
    // 缓存中的模板已被删除，清空缓存走重建逻辑
    _templateCache = null;
  }
  const existing = await prisma.courseTemplate.findFirst();
  const row: TemplateRow = !existing
    ? await prisma.courseTemplate.create({
        data: {
          name: TEMPLATE.name,
          version: COURSE_VERSION,
          modules: TEMPLATE as object, // 存储完整模板对象，getModules 需要访问 .modules 属性
        },
      })
    : await prisma.courseTemplate.update({
        where: { id: existing.id },
        data: {
          name: TEMPLATE.name,
          version: COURSE_VERSION,
          modules: TEMPLATE as object, // 存储完整模板对象
        },
      });
  _templateCache = { version: COURSE_VERSION, row };
  return row;
}

// ===== 模块查询辅助（供 classroom.ts 使用）=====
// CourseTemplate.modules 字段本身存的就是 CourseTemplateData 对象
type TemplateRow = { id: string; name: string; version: string; modules: unknown };

function asData(tpl: TemplateRow): CourseTemplateData {
  return tpl.modules as unknown as CourseTemplateData;
}

export function getModules(tpl: TemplateRow): CourseTemplateData['modules'] {
  return asData(tpl).modules;
}

export function getModuleIndex(tpl: TemplateRow, moduleId: string): number {
  return asData(tpl).modules.findIndex((m) => m.id === moduleId);
}

export function findModule(
  tpl: TemplateRow,
  moduleId: string | null,
): CourseTemplateData['modules'][number] | undefined {
  if (!moduleId) return undefined;
  return asData(tpl).modules.find((m) => m.id === moduleId);
}
