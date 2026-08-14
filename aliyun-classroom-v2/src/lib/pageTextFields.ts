// =========================================================
// 内置页文字字段定义（客户端安全，供教师端"改文字"弹窗用）
// 每个内置页有哪些可编辑字段 + 默认值（从 config 取）。
// 大屏渲染用 overrides ?? 默认值（见 usePageText.ts）。
// =========================================================
import { A0_INTRO, A0_REVEAL, A1_STAGES } from '@/features/avatarLesson/config';
import { A2_STAGES, A2_HOOK } from '@/features/siteEntry/config';

export interface TextFieldDef {
  key: string; // overrides 的 key
  label: string; // 中文名
  def: string; // 默认值（config 里的原文）
}

// 通用 hook 字段
function hookFields(h: { eyebrow: string; title: string; body1: string; body2: string; bridge: string }): TextFieldDef[] {
  return [
    { key: 'eyebrow', label: '小标题', def: h.eyebrow },
    { key: 'title', label: '大标题', def: h.title },
    { key: 'body1', label: '正文1', def: h.body1 },
    { key: 'body2', label: '正文2', def: h.body2 },
    { key: 'bridge', label: '过渡语', def: h.bridge },
  ];
}

function stageFields(s: { screenTitle: string; screenQuestion: string; studentTask: string }): TextFieldDef[] {
  return [
    { key: 'screenTitle', label: '大屏标题', def: s.screenTitle },
    { key: 'screenQuestion', label: '大屏问题', def: s.screenQuestion },
    { key: 'studentTask', label: '学生任务说明', def: s.studentTask },
  ];
}

// 根据内置页 refKey 返回可编辑字段清单
export function getFieldDefs(refKey: string | null): TextFieldDef[] {
  if (!refKey) return [];

  // A0 开场页
  if (refKey === 'a0:intro1') return [
    { key: 'eyebrow', label: '小标题', def: A0_INTRO.intro1.eyebrow },
    { key: 'title', label: '大标题', def: A0_INTRO.intro1.title },
  ];
  // a0:intro2（二维发展图）文字已不渲染（只显示图本身 + 图内标题），故不可编辑
  if (refKey === 'a0:intro2') return [];
  if (refKey === 'a0:mirror') return [
    { key: 'eyebrow', label: '小标题', def: A0_INTRO.mirror.eyebrow },
    { key: 'title', label: '大标题', def: A0_INTRO.mirror.title },
    { key: 'body1', label: '正文1', def: A0_INTRO.mirror.body1 },
    { key: 'body2', label: '正文2', def: A0_INTRO.mirror.body2 },
  ];
  if (refKey === 'a0:closing') return [
    { key: 'eyebrow', label: '小标题', def: A0_INTRO.closing.eyebrow },
    { key: 'title', label: '大标题', def: A0_INTRO.closing.title },
    { key: 'body1', label: '正文1', def: A0_INTRO.closing.body1 },
    { key: 'body2', label: '正文2', def: A0_INTRO.closing.body2 },
  ];

  // A0 揭晓
  if (refKey === 'reveal:1') return [{ key: 'headline', label: '揭晓大标题', def: A0_REVEAL.headline }];
  if (refKey === 'reveal:2') return [
    { key: 'screenTitle', label: '表单大标题', def: A0_REVEAL.formsTable.title },
    { key: 'screenQuestion', label: '表单副标题', def: A0_REVEAL.formsTable.subtitle },
  ];

  // A1 数字分身
  if (refKey === 'avatar:hook') return []; // 钩子页现在只显示一张图，无文字可编辑
  if (refKey.startsWith('avatar:c')) {
    const k = refKey.slice('avatar:'.length); // avatar:c1 → c1
    const st = A1_STAGES.find((s) => s.key === k);
    if (!st) return [];
    if (st.media) return []; // 图/视频屏无文字
    return stageFields(st);
  }
  if (refKey === 'avatar:wall') return [{ key: 'screenTitle', label: '作品墙标题', def: '全班数字分身 · 朋友圈墙' }];

  // A2 快速入门网站
  if (refKey === 'a2:hook') return hookFields(A2_HOOK);
  if (refKey.startsWith('a2:s')) {
    const k = refKey.slice('a2:'.length); // a2:s1 → s1
    const st = A2_STAGES.find((s) => s.key === k);
    if (!st) return [];
    if (st.media) return []; // 图/视频屏无文字
    return stageFields(st);
  }
  if (refKey === 'a2:wall') return [{ key: 'screenTitle', label: '作品墙标题', def: '全班作品墙' }];

  return [];
}

// 目标横幅字段（钩子页额外可编辑）
export function getBannerFields(_refKey: string | null): TextFieldDef[] {
  return [];
}
