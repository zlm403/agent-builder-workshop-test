// =========================================================
// 命名内容插槽定义（内置功能页的固定插入位）
// 与内容页动态 slot（page:{id}，由 /api/pages/slots 实时返回）区分：
//   命名 slot = 大屏内置页组件里硬编码渲染的 <ContentSlot slot="..."> 位置，
//   只能在此手工维护，必须与大屏组件实际渲染的 key 完全一致（否则插了不显示）。
// 教师端媒体库下拉 = 命名 slot（本文件）+ 内容页 slot（动态 API），两组合并。
// 分组名与 pages.ts 的 PAGE_GROUPS 保持一致。
// =========================================================

export interface SlotDef {
  key: string; // slot 值，如 a1_wall_after
  label: string; // 下拉显示
  group: string; // 分组：A0 / A1 / A2
}

// 仅列出大屏组件真实渲染的命名 slot（2026-08-21 逐组件核对）：
//   A0 AvatarA0Screen：a0_top / a0_closing_video / a0_reveal_after / a0_forms_after
//   A1 AvatarA1Screen：a1_top / a1_c7~c10_after / a1_wall_after / a1_video_after
//   A2 SiteEntryScreen：a2_top / a2_hook_after / a2_s4/s5/s6/s8_after / a2_wall_after
// 已移除死 slot（大屏不再渲染）：a0_questions_after / a0_art_after / a0_slider_after /
//   a1_hook_after / a1_c1~c6_after / a1_c11_after / a2_s1~s3/s7/s9/s10_after
export const CONTENT_SLOTS: SlotDef[] = [
  // ---- A0 开场（三问 / 揭晓 / 收束）----
  { key: 'a0_top', label: 'A0 环节最前', group: 'A0' },
  { key: 'a0_closing_video', label: 'A0 收束 · 视频位', group: 'A0' },
  { key: 'a0_reveal_after', label: 'A0 揭晓之后', group: 'A0' },
  { key: 'a0_forms_after', label: 'A0 三种形态之后', group: 'A0' },

  // ---- A1 数字分身（c1-c6/c11 已改内容页，只剩内置功能页 c7-c10 + 钩子/墙/视频）----
  { key: 'a1_top', label: 'A1 环节最前', group: 'A1' },
  { key: 'a1_c7_after', label: 'A1 梦想①打开世界之后', group: 'A1' },
  { key: 'a1_c8_after', label: 'A1 梦想②一个人与一支队伍之后', group: 'A1' },
  { key: 'a1_c9_after', label: 'A1 现实：一人公司之后', group: 'A1' },
  { key: 'a1_c10_after', label: 'A1 现实信号之后', group: 'A1' },
  { key: 'a1_wall_after', label: 'A1 作品墙之后', group: 'A1' },
  { key: 'a1_video_after', label: 'A1 视频·普通人的例子之后', group: 'A1' },

  // ---- A2 快速入门网站（钩子开场/s1/s2/s3/s7/s9/s10 已改内容页，只剩内置功能页 s4/s5/s6/s8 + 墙）----
  { key: 'a2_top', label: 'A2 环节最前', group: 'A2' },
  { key: 'a2_s4_after', label: 'A2 会前准备之后', group: 'A2' },
  { key: 'a2_s5_after', label: 'A2 AI团队开会→自动执行之后', group: 'A2' },
  { key: 'a2_s6_after', label: 'A2 检验、迭代、提交之后', group: 'A2' },
  { key: 'a2_s8_after', label: 'A2 梦想墙之后', group: 'A2' },
  { key: 'a2_wall_after', label: 'A2 作品墙之后', group: 'A2' },
];

export function slotLabel(key: string): string {
  return CONTENT_SLOTS.find((s) => s.key === key)?.label ?? key;
}

// 命名 slot 分组（与 pages.ts 的 PAGE_GROUPS 一致；A3/CLOSING 无命名 slot，靠内容页动态 slot）
export const SLOT_GROUPS = ['A0', 'A1', 'A2'];
