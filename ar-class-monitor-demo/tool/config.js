/* ============ 第二课作品 · 校园活动方案生成器 ============
   这里是「规则配置」—— 学员动手改这个文件，就是「设置规则」。
   改法：
   1. venues：可选场地 + 容量（人数超过容量 → 生成器会警告）
   2. minBudgetPerHead：人均最低预算（预算不足 → 生成器会提示）
   3. planTemplates：方案环节模板（生成器按它拆解步骤） */

const TOOL_CONFIG = {
  title: '校园活动方案生成器',
  intro: '这是示例规则。把它改成你自己的规则：\n① venues 场地与容量，② minBudgetPerHead 人均预算下限，③ planTemplates 方案环节。',

  // 场地与容量（规则：人数不能超过场地容量）
  venues: [
    { name: '教室', capacity: 80 },
    { name: '礼堂', capacity: 500 },
    { name: '体育馆', capacity: 2000 },
    { name: '操场', capacity: 5000 }
  ],

  // 人均最低预算（规则：总预算 / 人数 低于此值 → 提示预算紧张）
  minBudgetPerHead: 20,

  // 方案环节模板（规则：生成方案按这些环节拆解步骤）
  planTemplates: [
    { key: 'prep',   title: '① 前期筹备', desc: '成立策划组、宣传预热、物料采购、嘉宾邀请' },
    { key: 'flow',   title: '② 现场流程', desc: '签到 → 开场 → 主环节 → 互动 → 结束收尾' },
    { key: 'supply', title: '③ 物资清单', desc: '按人数与场地自动估算桌椅、音响、饮用水等' },
    { key: 'team',   title: '④ 人员分工', desc: '策划 / 宣传 / 物资 / 现场 / 应急五组' },
    { key: 'budget', title: '⑤ 预算表',   desc: '物料 + 场地 + 宣传 + 应急预留，逐项估算' },
    { key: 'risk',   title: '⑥ 应急预案', desc: '天气变化 / 设备故障 / 人员拥挤 / 医疗安全' }
  ],

  // 规范输出：方案抬头
  planHeader: '【校园活动方案】'
};
