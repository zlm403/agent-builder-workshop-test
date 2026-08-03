// 学员按 A01 实操方式归为三类，驱动 A02/A03 的个性化推送内容。
// 三类与课程路径一一对应：一次性问答→路径一、多轮修改→路径二、任务流程→路径三。

export type AiStyle = 'one_shot' | 'multi_round' | 'stepwise';

export interface StyleProfile {
  key: AiStyle;
  label: string; // 学员分类标签
  pathName: string; // 对应课程路径
  oneLiner: string; // 一句话画像
  a02Shortfall: string; // A02 · 审视现状：学生端「你的不足」
  a03Focus: string; // A03 · 你需要什么：学生端「重点去听」
  teacherHint: string; // 教师端：给不同类的教学提示与推送重点
}

export const STYLE_PROFILES: Record<AiStyle, StyleProfile> = {
  one_shot: {
    key: 'one_shot',
    label: '一次性问答型',
    pathName: '路径一 · 一次性问答',
    oneLiner: '把整个任务一次性丢给 AI，拿到整篇答案就直接提交',
    a02Shortfall:
      '你的不足：你倾向于一次性把问题丢给 AI，拿到整篇答案就直接提交。中间缺少对象界定、资料依据和结果检查，答案质量高度依赖运气——选题、资料、素材稍微一换，结果就可能全错。',
    a03Focus:
      '重点去听：① 如何把模糊任务拆成「对象 / 资料 / 规则 / 成果」四步；② 怎么给 AI 喂资料并要求它“依据材料、标注出处”；③ 为什么拿到答案后必须做一遍核验再交付。',
    teacherHint:
      '这类学员最需要“任务拆解 + 资料边界”训练。A03 多花时间在「诊断 → 设计 → 检查」的分步演示，让他们从“问一句等答案”变成“搭一个流程”。',
  },
  multi_round: {
    key: 'multi_round',
    label: '多轮修改型',
    pathName: '路径二 · 多轮修改',
    oneLiner: '会反复让 AI 修改，但主要停留在对话层打磨',
    a02Shortfall:
      '你的不足：你会反复让 AI 修改、调整，这比一次性问答进了一步；但你主要在“对话层”打磨，还没形成可复用的流程——下次遇到类似任务，还得从头把需求解释一遍。',
    a03Focus:
      '重点去听：① 如何把多轮对话里“反复强调的要求”沉淀成固定规则；② 如何把「对象 / 资料 / 规则 / 步骤」固化成一次，之后反复复用（这就是 Agent 工作流）；③ 如何把临场发挥变成可交付的标准动作。',
    teacherHint:
      '这类学员已经会迭代，瓶颈是“无法沉淀”。A03 重点讲工作流化：把对话里反复说的要求变成系统配置，下次一键复用。',
  },
  stepwise: {
    key: 'stepwise',
    label: '任务流程型',
    pathName: '路径三 · 任务流程',
    oneLiner: '会分步拆解、给资料、检查，已接近 Agent 式用法',
    a02Shortfall:
      '你的不足：你已经会分步拆解、提供资料并做检查，接近 Agent 式用法，是三类中起点最高的。但你仍可能忽略资料边界与依据校验，导致流程一旦遇到越界 / 异常输入就会失效，还以为是 AI 的问题。',
    a03Focus:
      '重点去听：① 如何为流程加“边界”与“依据校验”，让 Agent 在异常 / 越界输入下依然可控；② 如何设计可复用的标准动作；③ 如何把这套流程交付给不懂 AI 的同事也能跑起来。',
    teacherHint:
      '这类学员基础最好，不必重复基础讲解。A03 直接给进阶挑战：边界测试、压力测试、可交付化，并可让他们现场演示带动其他两类。',
  },
};

export const STYLE_ORDER: AiStyle[] = ['one_shot', 'multi_round', 'stepwise'];

// 返回对应分类画像；无法判定时返回 null（调用方用占位文案兜底）。
export function getStyleProfile(style?: string | null): StyleProfile | null {
  if (!style) return null;
  return STYLE_PROFILES[style as AiStyle] ?? null;
}
