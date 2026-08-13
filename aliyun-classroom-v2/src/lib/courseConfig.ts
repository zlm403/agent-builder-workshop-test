import { prisma } from './db';
import type { CourseTemplateData, ModuleConfig } from './types';

// 课程模板版本。每次大幅调整模块结构时递增，便于追溯。
export const COURSE_VERSION = 'A-v7';

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
      title: '你平时是怎么用 AI 的',
      durationSeconds: 420,
      teacherContent: {
        headline: 'A0-1 · 开场 + 三问',
        subline: '开场：手指图(首次接触)→二维发展图→三问(不透露关系测试)',
        bullets: [
          '开场1：手指图，讲"和 AI 第一次相遇"的故事',
          '开场2：二维发展图（横轴时间/纵轴人们用它做什么）',
          '三问：不要引导，别提前透露这是关系测试，让学生自然说',
          '收齐后由系统判定每位学生的关系',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_questions' },
    },
    {
      id: 'A0N_VOTE',
      type: 'a0_new',
      title: '系统判定：工具 or 伙伴',
      durationSeconds: 180,
      teacherContent: {
        headline: 'A0-2 · 系统判定学生与 AI 的关系',
        subline: '基于三问回答自动判定（学生不知道自己被判断）',
        bullets: [
          '学生提交后系统后台判定，学生端不打扰',
          '大屏实时显示系统判定的两边占比',
          '这是"揭晓时刻"：学生突然看到全班结果，产生第二次落差',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_vote' },
    },
    {
      id: 'A0N_REVEAL',
      type: 'a0_new',
      title: '揭晓 + 讲解',
      durationSeconds: 420,
      teacherContent: {
        headline: 'A0-3 · 揭晓 → 六步滑块 → 两图 → 镜子 → 收束',
        subline: '揭晓占比 → 三种形态对比 → 六步滑块(发现器) → 工具/伙伴两图 → 镜子"我们在哪儿" → 收束"已经来了"',
        bullets: [
          '屏1：工具X% · 伙伴X%（揭晓时刻话术："我们刚才不是在测试你懂不懂AI，而是看平时把AI当什么"）',
          '屏2：三种形态本质区别表（过去/现在/未来）',
          '屏3：六步滑块——先问"为什么会有工具和伙伴的区别"，再让学生滑一件真实事谁更适合做哪步（发现器，不讲概念）',
          '屏4：工具/伙伴两图——不解释，先问"你更愿意成为哪一种？"（点燃想象）',
          '屏5：镜子——"我们在哪儿？"心理停顿',
          '屏6：收束——电子海啸图 + 三个视频（罗振宇/腾讯/央视）→ A1 过渡',
        ],
        revealOrder: ['reveal:1', 'reveal:2', 'reveal:4', 'reveal:3:1', 'reveal:3:2', 'a0:mirror', 'a0:closing'],
      },
      studentTask: {},
      screenContent: { phase: 'a0n_reveal' },
    },
    {
      id: 'A1_AVATAR',
      type: 'avatar_flow',
      title: '数字分身',
      durationSeconds: 1800,
      teacherContent: {
        headline: 'A1 · 一起养一个「数字的你」',
        subline: '钩子开场 → 六步逐格点亮 → 学生手机连续对话 → 朋友圈墙',
        bullets: [
          '钩子：如果有「另一个你」替你干活，你去吃喝玩乐？→ 引入做「数字的你」',
          '六步（未来流程）：目标定义 → 方案设计 → 能力调动 → 执行创造 → 结果验证 → 迭代优化',
          '能力调动时 AI 按 7 个问题了解学生 → 生成 Skill 文件卡，学生加载后让分身写朋友圈',
          '发朋友圈是"人拿去检验分身"，最后产出朋友圈作品上大屏',
        ],
        revealOrder: ['avatar:hook', 'avatar:c1', 'avatar:c2', 'avatar:c3', 'avatar:c4', 'avatar:c5', 'avatar:c6', 'avatar:c7', 'avatar:c8', 'avatar:c9', 'avatar:c10', 'avatar:c11', 'avatar:c12', 'avatar:c13', 'avatar:c14', 'avatar:c15', 'avatar:c16', 'avatar:c17', 'avatar:wall'],
      },
      studentTask: {},
      screenContent: { phase: 'avatar_flow' },
    },

    // ===================== 方案二：快速入门网站 =====================
    {
      id: 'P2_SITE',
      type: 'site_entry',
      title: '快速入门网站',
      durationSeconds: 900,
      teacherContent: {
        headline: 'P2 · 做一款「快速入门网站」',
        subline: '手机端一个对话框，不停地问、不停地说；最后 AI 生成网站、小白测试、发布',
        bullets: [
          '六步：选择领域 → 定义入场任务 → 建立知识骨架 → 形成判断标准 → 设计网站路径 → 创作迭代',
          'AI 按五屏结构生成 HTML 网站第一版',
          '学生做「小白测试」，AI 评审可发布性，通过后发布上墙',
        ],
        revealOrder: [
          'p2:hook',
          'p2:s1', 'p2:s2', 'p2:s3', 'p2:s4', 'p2:s5', 'p2:s6',
          'p2:s7', 'p2:s8', 'p2:s9', 'p2:s10', 'p2:s11', 'p2:s12',
          'p2:wall',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'site_entry' },
    },

    // ===================== 方案三：养成游戏 =====================
    {
      id: 'P3_GAME',
      type: 'grow_game',
      title: '养成游戏',
      durationSeconds: 900,
      teacherContent: {
        headline: 'P3 · 做一款你的「养成游戏」',
        subline: '手机端一个对话框，不停地问、不停地说；最后 AI 生成游戏、试玩修改、发布',
        bullets: [
          '六步：提出设想 → 定义成长 → 建立规则 → 设计事件 → 设计结局 → 创作迭代',
          'AI 按「属性 + 事件 + 结局」生成手机养成游戏第一版',
          '学生试玩，检查选择是否有效、冲突是否好玩，通过后发布上墙',
        ],
        revealOrder: [
          'p3:hook',
          'p3:s1', 'p3:s2', 'p3:s3', 'p3:s4', 'p3:s5', 'p3:s6', 'p3:s7', 'p3:s8', 'p3:s9', 'p3:s10',
          'p3:wall',
        ],
      },
      studentTask: {},
      screenContent: { phase: 'grow_game' },
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
            h: '你能做出来给别人用吗？',
            p: '三次动手，你把一个想法变成了别人能用的东西：帮人入门的网站、让人选择的游戏。',
          },
          {
            h: '三样作品，分别教会了你什么？',
            p: '网站教你把陌生讲清楚，游戏教你把规则变好玩，数字分身教你把一件事认认真真做完。',
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
