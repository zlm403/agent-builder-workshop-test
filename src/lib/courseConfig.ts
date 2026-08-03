import { prisma } from './db';
import type { CourseTemplateData } from './types';

export const COURSE_VERSION = 'A-v3';

// 考研英语任务：A01 基线测试使用的真实任务与资料
const BASELINE_TASK = {
  prompt:
    '请使用 AI，为准备考研的小林制定一轮英语阅读训练方案。你可以自由决定怎样向 AI 说明任务、是否使用给定资料、分几步完成、是否检查 AI 的结果。按你平时真实使用 AI 的方式完成即可。',
  requirements: [
    '找出小林最主要的学习问题',
    '基于提供的材料设计一次约 30 分钟的训练',
    '让 AI 生成一道测试题',
    '检查 AI 给出的内容是否符合材料',
    '提交你最终认可的结果',
  ],
  materials: [
    {
      id: 'profile',
      title: '学生情况：小林',
      kind: 'student_profile',
      body:
        '大学三年级，准备参加考研。\n英语阅读平均每篇错 3 题。\n每天可训练时间约 30 分钟。',
    },
    {
      id: 'issues',
      title: '小林近期三个主要问题',
      kind: 'recent_issues',
      body:
        '1. 长难句理解困难；\n2. 容易用自己的常识代替原文；\n3. 做完题只看答案，不分析错误原因。',
    },
    {
      id: 'reading',
      title: '阅读材料（来源：模拟考研英语真题节选）',
      kind: 'reading_material',
      body:
        'The shift toward remote work has changed how teams measure productivity. ' +
        'A 2021 study found that output rose in the first months, but long-term ' +
        'collaboration suffered as informal knowledge sharing declined. Researchers ' +
        'warn that companies may be optimizing for visible tasks while ignoring the ' +
        'slow loss of shared context.\n\n' +
        '词汇提示：productivity 生产力；informal knowledge sharing 非正式知识共享；' +
        'shared context 共同语境；optimizing 优化。',
    },
  ],
  timeLimitSec: 480,
  taskArea: {
    targetUser: '准备考研的小林',
    goal: '改善英语阅读训练',
    available: '阅读文章、错题情况、学习时间',
    finalDeliverable: '一份可执行训练 + 一道测试题',
  },
} as const;

const TEMPLATE: CourseTemplateData = {
  version: COURSE_VERSION,
  name: 'AI 使用方式诊断与训练',
  subtitle: '从真实任务出发，看见你与 AI 协作的方式',
  modules: [
    {
      id: 'A0_SCREENING',
      title: 'AI面试 · 第1问',
      type: 'hr_screening',
      durationSeconds: 90,
      teacherContent: {
        headline: 'AI 面试现场：你会用 AI 吗？',
        bullets: [
          '大屏进入“AI 面试现场”：只出现一个问题——你说自己会使用 AI，能用一个真实例子证明吗？',
          '学生用手机自由回答（建议 45 秒，不必包装）→ 提交',
          'AI 只追问一次最缺失的信息，再给出“当前 AI 标签”反馈卡',
          '收束：大屏揭晓全班标签分布，对比不同回答，引出从工具到系统的差距',
        ],
        screenBrief: '把手机当作面试现场：你只有一次机会，用一个真实例子证明你“会用 AI”。',
        hrBrief: '你现在是一个正在招聘的 AI 面试官。请基于候选人的真实回答，判断其当前 AI 标签（工具体验者 / 任务解决者 / 应用创造者），并只追问一个最缺失的信息。',
        note: 'A0 收集每个人的真实回答与当前 AI 标签，作为销售跟进与下节课衔接依据。',
      },
      studentTask: {
        prompt: '你说自己会使用AI。能用一个真实例子证明吗？',
        placeholder: '我曾经用AI……',
        allowPaste: true,
      },
      screenContent: { phase: 'screening' },
    },
    {
      id: 'A01_BASELINE',
      title: 'A01 完成考研英语 AI 实战任务',
      type: 'ai_task',
      durationSeconds: 480,
      teacherContent: { ...BASELINE_TASK, screenPhase1: {
        headline: '8 分钟 AI 实战挑战',
        subline: '使用 AI，为一名准备考研的学生设计一次英语阅读训练。',
        brief: '你可以自由决定：怎样向 AI 说明任务、是否使用给定资料、分几步完成、是否检查 AI 的结果。不要追求写得漂亮，按你平时真实使用 AI 的方式完成。',
      } },
      studentTask: { prompt: BASELINE_TASK.prompt, requirements: BASELINE_TASK.requirements, allowPaste: true },
      screenContent: { phase: 'task' },
    },
    {
      id: 'A02_MIRROR',
      title: 'A02 查看全班真实使用方式',
      type: 'class_mirror',
      durationSeconds: 600,
      teacherContent: {
        headline: '刚才，全班是怎样使用 AI 的？',
        metricLabels: {
          started: '已开始任务',
          usedMaterial: '使用了给定资料',
          iterated: '进行了二次追问/修改',
          verified: '主动检查内容依据',
          submitted: '已提交成果',
        },
        paths: [
          { name: '路径一 · 一次性问答', steps: ['提出一个大问题', 'AI 生成完整答案', '直接提交'] },
          { name: '路径二 · 多轮修改', steps: ['提出任务', '查看结果', '要求修改', '提交'] },
          { name: '路径三 · 任务流程', steps: ['分析对象', '提供资料', '明确规则', '分步执行', '检查依据', '修改结果', '提交'] },
        ],
        question: '大家使用的是同一个 AI，为什么结果和过程差别这么大？',
      },
      screenContent: { phase: 'mirror' },
    },
    {
      id: 'A03_LECTURE',
      title: 'A03 解释为什么结果不同',
      type: 'lecture',
      durationSeconds: 600,
      teacherContent: {
        headline: '从聊天式使用到 Agent 式工作',
        bullets: [
          '同一个 AI，输入方式决定输出质量：对象、目标、资料、规则、流程缺一不可。',
          '资料边界：明确要求 AI 依据给定材料，避免用常识替代原文。',
          '任务拆解：先诊断问题、再设计、再生成、再检查，而不是一次性要答案。',
          '验证意识：让 AI 逐项说明依据，并核对是否能在原文找到出处。',
          '流程意识：把一次对话沉淀为可重复的步骤，才是 Agent 的起点。',
        ],
        comparison: {
          bad: '“帮我做一份考研英语学习计划。”——对象模糊、无资料、无规则、无校验。',
          good: '“根据小林的错题，先判断最主要问题；再基于给定材料设计 30 分钟训练；最后说明每步针对哪个问题，并核对测试题能否在原文找到依据。”',
        },
      },
      screenContent: { phase: 'lecture' },
    },
    {
      id: 'A04_DEFINE_TASK',
      title: 'A04 定义产品服务谁',
      type: 'agent_config',
      durationSeconds: 420,
      teacherContent: {
        headline: '从“给自己做”到“给别人用”',
        note: '引导学生把刚学到的方法，从“为自己做工具”切换到“做一个可以交给别人用的产品”。先想清楚：这个产品服务谁？',
      },
      studentTask: {
        prompt: '刚才你是为“自己”做了一个工具。现在换个角度：如果把它做成产品、交给别人用，你先要明确——它服务谁？他们要解决什么？最终得到什么？',
        allowPaste: true,
        fields: [
          { key: 'who', label: '目标用户（别人，不是你自己）', placeholder: '例如：备考的学弟 / 一名运营同事', required: true },
          { key: 'goal', label: '目标', placeholder: '这个用户要解决什么问题', required: true },
          { key: 'deliverable', label: '最终交付物', placeholder: '用户最终拿到什么', required: true },
        ],
      },
      screenContent: { phase: 'define' },
    },
    {
      id: 'A05_ADD_SOURCE',
      title: 'A05 配置语料库（知识库）',
      type: 'source_select',
      durationSeconds: 420,
      teacherContent: {
        headline: '知识库 / 语料库：给别人用，最大的不同在这里',
        note: '点题：同一套方法，喂给谁的语料，决定它服务谁。换一个服务对象，语料库就要换一批——这就是“给自己用”和“给别人用”最大的区别。',
      },
      studentTask: {
        prompt: '现在这个产品要服务真实的人。请为它配置可依据的语料库：只能依据这些资料工作，超出范围必须说明。记住——给不同的人用，语料库要随之改变。',
        allowPaste: true,
        allowExample: true,
      },
      screenContent: { phase: 'source' },
    },
    {
      id: 'A06_SET_RULES',
      title: 'A06 沉淀规则（skill 雏形）',
      type: 'rule_config',
      durationSeconds: 420,
      teacherContent: {
        headline: '规则 = skill 的雏形',
        note: '这些规则，就是把你的方法沉淀成可复用的边界与禁忌。主方法不变，套给谁都行——这已经是“skill”的雏形。',
      },
      studentTask: {
        prompt: '为产品设置规则（这是 skill 的雏形）：固定角色、资料边界、禁止事项、输出格式。你可以只勾选认可的规则。',
        ruleSections: [
          { key: 'noFabricate', label: '不编造事实', desc: '只依据给定语料，不凭空生成数据/结论' },
          { key: 'citeSource', label: '标注出处', desc: '每个结论注明来自哪份资料' },
          { key: 'fixedRole', label: '固定角色', desc: '始终以设定的专家身份回答' },
          { key: 'refuseOOB', label: '超范围拒绝', desc: '超出语料范围时明确说“依据不足”，不硬答' },
          { key: 'fixedFormat', label: '固定格式', desc: '输出遵循规定结构' },
          { key: 'zhOnly', label: '只用中文', desc: '全程简体中文' },
        ],
      },
      screenContent: { phase: 'rules' },
    },
    {
      id: 'A07_CONFIG_FLOW',
      title: 'A07 配置流程（skill 骨架）',
      type: 'workflow_order',
      durationSeconds: 420,
      teacherContent: {
        headline: '流程 = skill 的执行骨架',
        note: '把方法拆成有序步骤，这就是 skill 的“执行流程”。给别人用时，流程保持一致——方法沉淀完成，便可复用。',
      },
      studentTask: {
        prompt: '把任务拆成有序步骤，形成可重复流程（这是 skill 的执行骨架）。可拖动调整顺序。',
        workflowSteps: [
          '诊断服务对象的问题',
          '检索可用语料',
          '生成初稿',
          '依据语料自检',
          '交付成果',
        ],
      },
      screenContent: { phase: 'flow' },
    },
    {
      id: 'A08_FIRST_RUN',
      title: 'A08 在网页上运行',
      type: 'ai_run',
      durationSeconds: 420,
      teacherContent: {
        headline: '可视化运行：看它“给别人干活”',
        note: '在网页上点一下，可视化看到产品按你设定的角色/规则/流程、只用你给的语料，为一个真实用户产出结果。这一步让学员“理解”Agent 是怎么跑起来的。',
      },
      studentTask: {
        prompt: '运行你的产品：它会按你设定的角色/规则/流程、只用你配置的语料库，为一个真实用户产出结果。观察它是否“守规矩”。',
        scenario: 'normal',
      },
      screenContent: { phase: 'run' },
    },
    {
      id: 'A09_STRESS_TEST',
      title: 'A09 压力测试（边界）',
      type: 'stress_test',
      durationSeconds: 420,
      teacherContent: {
        headline: '给别人用，最怕“别人乱用”时它乱来',
        note: '给别人用，必然遇到超范围请求。这一步测试：当请求明显超出语料范围时，产品是否会越界编造，还是老实说“依据不足”。',
      },
      studentTask: {
        prompt: '给产品一个明显超出语料范围的请求，看它是否会越界编造，还是老实说“依据不足，无法回答”。',
        scenario: 'stress',
      },
      screenContent: { phase: 'stress' },
    },
    {
      id: 'A10_IMPROVE',
      title: 'A10 收集反馈升级',
      type: 'compare_runs',
      durationSeconds: 420,
      teacherContent: {
        headline: '反馈来自使用它的人：skill 靠反馈迭代',
        note: '真实产品中，改进信号来自使用它的人。对比“首次运行 vs 压力后改进”，理解 skill 如何靠反馈持续迭代。',
      },
      studentTask: {
        prompt: '先完成 A08 与 A09，再回到这里：根据压力测试结果修改规则/语料，再次运行，对比改进前后。',
      },
      screenContent: { phase: 'improve' },
    },
    {
      id: 'A11_ONE_CONFIG',
      title: 'A11 一人一配置（桥接）',
      type: 'persona_config',
      durationSeconds: 420,
      teacherContent: {
        headline: '关键收束：一套方法，服务很多人 = 一人公司的雏形',
        note: '同一套核心方法（角色/规则/流程不变），给不同服务对象自动套不同语料库，就变成“一个产品服务很多人”。这正是下一阶段“一人公司（多 Agent 协同）”的雏形。',
      },
      studentTask: {
        prompt: '下面三个对象，用的是同一套核心方法（角色/规则/流程不变），但语料库各不相同。点开看看：给别人用，到底什么变、什么不变？',
        coreExample: '角色：学习教练 ｜ 规则：不编造、标出处、超范围拒绝 ｜ 流程：诊断→检索→生成→自检→交付',
        personas: [
          { id: 'exam', name: '考研学生', corpus: '考研真题节选、错题本、长难句清单', note: '语料偏应试、重依据' },
          { id: 'pro', name: '职场运营', corpus: '行业报告、竞品案例、文案规范', note: '语料偏实用、重转化' },
          { id: 'kid', name: '小学生', corpus: '课文、绘本、字词表', note: '语料偏易懂、重趣味' },
        ],
      },
      screenContent: { phase: 'persona' },
    },
  ],
};

// 自愈式：确保 CourseTemplate 存在且版本为最新（旧模板会被更新，避免手动清库）
export async function ensureTemplate(_version = 'A'): Promise<{ id: string; name: string; version: string; modules: unknown }> {
  const existing = await prisma.courseTemplate.findFirst();
  if (!existing) {
    return prisma.courseTemplate.create({
      data: {
        name: TEMPLATE.name,
        version: TEMPLATE.version,
        modules: TEMPLATE as object,
      },
    });
  }
  // 始终同步为最新版本（配置驱动，老师改配置即可生效）
  return prisma.courseTemplate.update({
    where: { id: existing.id },
    data: {
      name: TEMPLATE.name,
      version: TEMPLATE.version,
      modules: TEMPLATE as object,
    },
  });
}

export function getTemplate(): CourseTemplateData {
  return TEMPLATE;
}

// ===== 模块查询辅助（供 classroom.ts 使用）=====
// CourseTemplate.modules 字段本身存的就是 CourseTemplateData 对象
type TemplateRow = { modules: unknown };

function asData(tpl: TemplateRow): CourseTemplateData {
  return tpl.modules as unknown as CourseTemplateData;
}

export function getModules(tpl: TemplateRow): CourseTemplateData['modules'] {
  return asData(tpl).modules;
}

export function getModuleIndex(tpl: TemplateRow, moduleId: string): number {
  return asData(tpl).modules.findIndex((m) => m.id === moduleId);
}

export function findModule(tpl: TemplateRow, moduleId: string | null): CourseTemplateData['modules'][number] | undefined {
  if (!moduleId) return undefined;
  return asData(tpl).modules.find((m) => m.id === moduleId);
}
