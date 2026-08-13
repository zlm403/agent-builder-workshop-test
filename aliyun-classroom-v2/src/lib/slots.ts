// =========================================================
// 全局内容插槽定义：每个环节的"可插入位置"（开头 / 某步骤之后）
// 教师端内容管理面板用这个列表选择插入位置，大屏按 slot 渲染
// 命名规则：<模块前缀>_<位置>_after 表示"某某之后"；<模块前缀>_top 表示"环节最前"
// 注意：必须与大屏组件实际渲染的 slot 保持一致（a1_c1_after / p2_s1_after / p3_s1_after…）
// =========================================================

export interface SlotDef {
  key: string; // slot 值，如 a1_goal_after
  label: string; // 下拉显示："A1 目标定义之后"
  group: string; // 分组：A0 / 数字分身 / 快速入门网站 / 养成游戏 / 收官
}

export const CONTENT_SLOTS: SlotDef[] = [
  // ---- A0（三问 / 判定 / 揭晓）----
  { key: 'a0_top', label: 'A0 环节最前', group: 'A0' },
  { key: 'a0_questions_after', label: 'A0 三问之后', group: 'A0' },
  { key: 'a0_reveal_after', label: 'A0 揭晓之后', group: 'A0' },
  { key: 'a0_forms_after', label: 'A0 三种形态之后', group: 'A0' },
  { key: 'a0_art_after', label: 'A0 艺术图之后', group: 'A0' },
  { key: 'a0_slider_after', label: 'A0 滑杆之后', group: 'A0' },

  // ---- A1 数字分身（钩子 + 十七环节 + 作品墙）----
  { key: 'a1_top', label: '数字分身 环节最前', group: '数字分身' },
  { key: 'a1_hook_after', label: '数字分身 钩子之后', group: '数字分身' },
  { key: 'a1_c1_after', label: '数字分身 发现问题之后', group: '数字分身' },
  { key: 'a1_c2_after', label: '数字分身 发布任务之后', group: '数字分身' },
  { key: 'a1_c3_after', label: '数字分身 选择真实任务之后', group: '数字分身' },
  { key: 'a1_c4_after', label: '数字分身 AI采访之后', group: '数字分身' },
  { key: 'a1_c5_after', label: '数字分身 补充真实样本之后', group: '数字分身' },
  { key: 'a1_c6_after', label: '数字分身 生成分身档案之后', group: '数字分身' },
  { key: 'a1_c7_after', label: '数字分身 校准档案之后', group: '数字分身' },
  { key: 'a1_c8_after', label: '数字分身 第一次写朋友圈之后', group: '数字分身' },
  { key: 'a1_c9_after', label: '数字分身 判断像不像之后', group: '数字分身' },
  { key: 'a1_c10_after', label: '数字分身 调整之后', group: '数字分身' },
  { key: 'a1_c11_after', label: '数字分身 最终验收之后', group: '数字分身' },
  { key: 'a1_c12_after', label: '数字分身 保存分身之后', group: '数字分身' },
  { key: 'a1_c13_after', label: '数字分身 梦想之后', group: '数字分身' },
  { key: 'a1_c14_after', label: '数字分身 一个到一群之后', group: '数字分身' },
  { key: 'a1_c15_after', label: '数字分身 分析之后', group: '数字分身' },
  { key: 'a1_c16_after', label: '数字分身 现实与紧迫之后', group: '数字分身' },
  { key: 'a1_c17_after', label: '数字分身 结论之后', group: '数字分身' },
  { key: 'a1_wall_after', label: '数字分身 作品墙之后', group: '数字分身' },
  { key: 'a1_video_after', label: '数字分身 视频之后', group: '数字分身' },

  // ---- P2 快速入门网站（钩子 + 十二阶段 + 作品墙）----
  { key: 'p2_top', label: '快速入门网站 环节最前', group: '快速入门网站' },
  { key: 'p2_hook_after', label: '快速入门网站 钩子之后', group: '快速入门网站' },
  { key: 'p2_s1_after', label: '快速入门网站 发布任务之后', group: '快速入门网站' },
  { key: 'p2_s2_after', label: '快速入门网站 明确目标之后', group: '快速入门网站' },
  { key: 'p2_s3_after', label: '快速入门网站 获取领域地图之后', group: '快速入门网站' },
  { key: 'p2_s4_after', label: '快速入门网站 判断与收缩之后', group: '快速入门网站' },
  { key: 'p2_s5_after', label: '快速入门网站 生成可用内容之后', group: '快速入门网站' },
  { key: 'p2_s6_after', label: '快速入门网站 生成网页之后', group: '快速入门网站' },
  { key: 'p2_s7_after', label: '快速入门网站 第一轮自检之后', group: '快速入门网站' },
  { key: 'p2_s8_after', label: '快速入门网站 同伴测试之后', group: '快速入门网站' },
  { key: 'p2_s9_after', label: '快速入门网站 根据反馈修改之后', group: '快速入门网站' },
  { key: 'p2_s10_after', label: '快速入门网站 能力迁移之后', group: '快速入门网站' },
  { key: 'p2_s11_after', label: '快速入门网站 提交与成果之后', group: '快速入门网站' },
  { key: 'p2_s12_after', label: '快速入门网站 升华之后', group: '快速入门网站' },
  { key: 'p2_wall_after', label: '快速入门网站 作品墙之后', group: '快速入门网站' },

  // ---- P3 养成游戏（钩子 + 十阶段）----
  { key: 'p3_top', label: '养成游戏 环节最前', group: '养成游戏' },
  { key: 'p3_hook_after', label: '养成游戏 钩子之后', group: '养成游戏' },
  { key: 'p3_s1_after', label: '养成游戏 空世界之后', group: '养成游戏' },
  { key: 'p3_s2_after', label: '养成游戏 核心特质之后', group: '养成游戏' },
  { key: 'p3_s3_after', label: '养成游戏 设计规则之后', group: '养成游戏' },
  { key: 'p3_s4_after', label: '养成游戏 AI翻译生成之后', group: '养成游戏' },
  { key: 'p3_s5_after', label: '养成游戏 投入共生缸之后', group: '养成游戏' },
  { key: 'p3_s6_after', label: '养成游戏 观察之后', group: '养成游戏' },
  { key: 'p3_s7_after', label: '养成游戏 修改之后', group: '养成游戏' },
  { key: 'p3_s8_after', label: '养成游戏 二次运行之后', group: '养成游戏' },
  { key: 'p3_s9_after', label: '养成游戏 创造过程卡之后', group: '养成游戏' },
  { key: 'p3_s10_after', label: '养成游戏 认知收束之后', group: '养成游戏' },

  // ---- 收官 ----
  { key: 'finale_top', label: '收官 环节最前', group: '收官' },
  { key: 'finale_after', label: '收官 成果回顾之后', group: '收官' },
  { key: 'finale_sale_after', label: '收官 销售转化之后', group: '收官' },
];

export function slotLabel(key: string): string {
  return CONTENT_SLOTS.find((s) => s.key === key)?.label ?? key;
}

export const SLOT_GROUPS = ['A0', '数字分身', '快速入门网站', '养成游戏', '收官'];
