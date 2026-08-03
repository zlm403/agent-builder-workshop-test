// 终章（一人公司）纯配置：仅含类型与常量，不依赖任何 Node/服务端模块，
// 因此可安全被客户端组件（'use client'）与服务端代码共同 import。
// 真正的运行时逻辑（跑 LLM、读写 DB、推 SSE）放在 @/lib/finale 与 @/lib/classroom。

export type FinaleAgent = {
  role: string; // 客户接待 / 需求诊断 / 方案执行 / 交付跟进
  nickname: string;
  personality: string;
  duty: string;
  boundary: string;
  rules: string;
  handoff: string;
};

export const SCENE_LABEL: Record<string, string> = {
  study: '学习辅导',
  shopping: '购物推荐',
  fun: '吃喝玩乐',
};

export const SCENE_ICON: Record<string, string> = {
  study: '🏫',
  shopping: '🛒',
  fun: '🎉',
};

// 三个场景里 4 个 Agent 的固定岗位（顺序固定：接待→诊断→执行→交付）。
export const SCENE_ROLES: Record<string, string[]> = {
  study: ['客户接待', '需求诊断', '方案执行', '交付跟进'],
  shopping: ['客户接待', '需求诊断', '方案执行', '交付跟进'],
  fun: ['客户接待', '需求诊断', '方案执行', '交付跟进'],
};

// 学生搭建时，每个 Agent 需要填写的属性字段（我们定字段名，学生填内容）。
export const AGENT_FIELDS: { key: keyof FinaleAgent; label: string; placeholder: string; rows?: number }[] = [
  { key: 'nickname', label: '昵称', placeholder: '给这个员工起个有趣的名字，例如「温柔学姐」' },
  { key: 'personality', label: '个性 / 说话风格', placeholder: '它是什么性格？怎么说话？例如「温柔耐心，爱用～和表情包」', rows: 2 },
  { key: 'duty', label: '职责', placeholder: '它主要负责干什么？例如「问清考什么、什么水平、目标分」', rows: 2 },
  { key: 'boundary', label: '边界（绝对不做什么）', placeholder: '什么事它绝不碰？例如「不诊断、不给建议，只收集信息」', rows: 2 },
  { key: 'rules', label: '规则（铁律）', placeholder: '必须遵守的规矩？例如「必须问满 3 个问题；禁止说可能/也许」', rows: 2 },
  { key: 'handoff', label: '交接（交给下一位的内容与格式）', placeholder: '干完活把什么、以什么格式交给谁？例如「把三点汇总成一句话交给需求诊断」', rows: 2 },
];
