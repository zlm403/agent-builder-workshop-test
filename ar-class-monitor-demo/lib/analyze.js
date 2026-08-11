/* =========================================================================
 * analyze.js — 理解棱镜穿透算法（一核多表版）
 *
 * 核：把学生在一门课里留下的「作品事件轨迹」拆成固定维度格子、标六色状态、
 *     找缺口（guess/clarify/empty/conflict）——让“学生以为做到了 / 实际缺了什么”
 *     的差距显影，供教师端热力、学生端镜子、大屏匿名投影三端共用。
 *
 * 表：每课穿各自的维度表，绝不统一套一套格子：
 *   pre 预备课 → 语言棱镜（10 格，文本正则）：把想法说清楚（已并入开场，保留兼容）
 *   t1  项目一（接金币游戏）→ 边界棱镜（5 格，事件驱动）：有依据地回答、在资料边界内
 *   t2  项目二（心情电量）→ 规则棱镜（6 格，事件驱动）：流程与规则、异常覆盖
 *   t3  项目三（内心戏）→ 系统棱镜（5 格，事件驱动）：能力与工具、交接与发布
 *
 * 状态六色（黄绿不混）：
 *   ok      ✅ 已确认  —— 明确做到了
 *   rec     📋 已识别  —— 有迹可循但未确认
 *   guess   🟡 AI推测  —— 弱推，必须标明为推测
 *   clarify △ 待澄清   —— 有提及但不足/模糊
 *   empty   ⬜ 空缺    —— 完全没有
 *   conflict🔴 冲突    —— 前后互斥
 * ========================================================================= */

const STATE = {
  ok:      { sym: '✅', cls: 'ok',     label: '已确认' },
  rec:     { sym: '📋', cls: 'rec',    label: '已识别' },
  guess:   { sym: '🟡', cls: 'guess',  label: 'AI推测' },
  clarify: { sym: '△',  cls: 'clarify',label: '待澄清' },
  empty:   { sym: '⬜', cls: 'empty',  label: '空缺' },
  conflict:{ sym: '🔴', cls: 'conflict',label: '冲突' },
};

const GAP_STATES = ['guess', 'clarify', 'empty', 'conflict'];

/* ========== 表 1 · 预备课 语言棱镜（10 格，文本） ========== */
const LANG_CELLS = [
  { i: 1,  key: 'object',   name: '使用对象',  hint: '谁在用（年龄/身份/基础/困难）' },
  { i: 2,  key: 'scene',    name: '使用场景',  hint: '什么情况下用' },
  { i: 3,  key: 'problem',  name: '当前问题',  hint: '用户遇到的具体困难' },
  { i: 4,  key: 'task',     name: '要完成的任务', hint: 'AI 要帮用户做什么' },
  { i: 5,  key: 'goal',     name: '预期目标',  hint: '可观察的结果（非愿望）' },
  { i: 6,  key: 'standard', name: '成功标准',  hint: '怎样算做到了' },
  { i: 7,  key: 'scope',    name: '内容范围',  hint: '知识/话题边界' },
  { i: 8,  key: 'interact', name: '互动方式',  hint: '对话/闯关/角色扮演…' },
  { i: 9,  key: 'limit',    name: '限制条件',  hint: '什么不能做/不能说' },
  { i: 10, key: 'output',   name: '最终输出',  hint: '产出什么形态的结果' },
];

function _hit(text, re) {
  const m = (text || '').match(re);
  return m ? m[0] : null;
}

function langGrid(text) {
  const t = (text || '').trim();
  const grid = LANG_CELLS.map(c => ({ ...c, state: 'empty', value: '' }));

  const taskHit = _hit(t, /(做|帮|生成|创建|设计|开发|写|搭建|做一个|帮我做|让我做)[^，。；\n]{0,20}/);
  if (taskHit) { grid[3].state = 'ok'; grid[3].value = taskHit; }

  const objSpecific = _hit(t, /(小学|初中|高中|大学|三年级|一年级|五年级|老人|老人家|上班族|程序员|孩子|小孩|学生|小学生|中学生|大学生|团队|员工|客服|老师|医生|宝妈)/);
  const objGeneric  = _hit(t, /(人|用户|大家|人们|朋友|我们|客户)/);
  if (objSpecific) { grid[0].state = 'ok'; grid[0].value = objSpecific; }
  else if (objGeneric) { grid[0].state = 'guess'; grid[0].value = objGeneric + '（泛人群·推测）'; }
  else if (/给|为|用于|针对/.test(t)) { grid[0].state = 'clarify'; grid[0].value = '提到"给谁"但未指明具体对象'; }

  const sceneHit = _hit(t, /(每天|早上|晚上|睡前|上课|课间|通勤|工作|学习|游戏|周末|旅行|医院|家里|课堂|地铁|公园)/);
  if (sceneHit) { grid[1].state = 'ok'; grid[1].value = sceneHit; }
  else if (/场景|时候|情况下|之中/.test(t)) { grid[1].state = 'guess'; grid[1].value = '提及场景但未具体'; }

  const probHit = _hit(t, /(不会|不愿|不想|怕|慢|记不住|学不会|听不进|开不了口|粗心|拖延|焦虑|不懂|困难|问题)/);
  if (probHit) { grid[2].state = 'ok'; grid[2].value = probHit + '（具体困难）'; }

  const goalMeas = _hit(t, /(\d+\s*(分钟|个|次|篇|分|小时|天|周|月)|[提高升][\d]|掌握\d|完成\d)/);
  const goalWish = _hit(t, /(喜欢|爱上|学会|提高|提升|掌握|理解|感兴趣|愿意)/);
  if (goalMeas) { grid[4].state = 'ok'; grid[4].value = goalMeas; }
  else if (goalWish) { grid[4].state = 'guess'; grid[4].value = goalWish + '（愿望型·需可观察化）'; }

  const stdHit = _hit(t, /(标准|算成功|达标|验收|怎样算|如何判断|通过条件)/);
  if (stdHit) { grid[5].state = 'ok'; grid[5].value = stdHit; }

  const scopeHit = _hit(t, /(资料|知识|课程|只|仅|关于|范围|根据)/);
  if (scopeHit) { grid[6].state = 'guess'; grid[6].value = scopeHit + '（范围待限定）'; }

  const intHit = _hit(t, /(对话|闯关|角色扮演|游戏|问答|点击|卡片|语音|聊天|互动)/);
  if (intHit) { grid[7].state = 'ok'; grid[7].value = intHit; }

  const limHit = _hit(t, /(不能|不要|禁止|只(能|可)|限制|不(能|可)说|不外传)/);
  if (limHit) { grid[8].state = 'ok'; grid[8].value = limHit; }

  const outHit = _hit(t, /(报告|网页|游戏|卡片|图片|结果|方案|应用|助手|工具|作品|视频)/);
  if (outHit) { grid[9].state = 'ok'; grid[9].value = outHit; }

  return grid;
}

/* ========== 表 2 · 第一课 边界棱镜（5 格，事件驱动） ==========
 * 教的底层：资料与边界 —— 整理资料 → 有依据地回答 → 测试资料内外问题 */
const BOUNDARY_CELLS = [
  { i: 1, key: 'data',    name: '资料整理',   hint: '进入游戏、接触课程资料区' },
  { i: 2, key: 'answer',  name: '有依据回答', hint: '答题正确率（依据是否可靠）' },
  { i: 3, key: 'test',    name: '边界测试',   hint: '主动测试资料内/外问题' },
  { i: 4, key: 'depth',   name: '测试深度',   hint: '多次测边界才可能探到边界' },
  { i: 5, key: 'out',     name: '边界外处理', hint: '测过资料外问题并看到处理' },
];

function boundaryGrid(events) {
  const evs = Array.isArray(events) ? events : [];
  const has = k => evs.some(e => e.event === k);
  const answered = evs.filter(e => e.event === 'question_answered');
  const tested = evs.filter(e => e.event === 'boundary_test');
  const grid = BOUNDARY_CELLS.map(c => ({ ...c, state: 'empty', value: '' }));

  if (has('game_start')) { grid[0].state = 'ok'; grid[0].value = '进入游戏（资料区）'; }

  if (answered.length) {
    const correct = answered.filter(e => e.payload && e.payload.correct).length;
    const rate = correct / answered.length;
    grid[1].state = rate >= 0.6 ? 'ok' : rate >= 0.3 ? 'guess' : 'clarify';
    grid[1].value = `答 ${answered.length} 题 · 对 ${correct} 题`;
  }

  if (tested.length) { grid[2].state = 'ok'; grid[2].value = `测了 ${tested.length} 次`; }

  if (tested.length >= 2) { grid[3].state = 'ok'; grid[3].value = `${tested.length} 次`; }
  else if (tested.length === 1) { grid[3].state = 'rec'; grid[3].value = '仅 1 次'; }

  if (tested.some(e => e.payload && e.payload.inScope === false)) { grid[4].state = 'ok'; grid[4].value = '测过资料外问题'; }

  return grid;
}

/* ========== 表 3 · 第二课 规则棱镜（6 格，事件驱动） ==========
 * 教的底层：流程与规则 —— 收集输入 → 检查信息 → 拆步骤 → 设规则 → 规范输出 → 测异常 */
const RULE_CELLS = [
  { i: 1, key: 'input',   name: '输入收集',   hint: '主题/人数/场地/预算/日期/时长' },
  { i: 2, key: 'check',   name: '信息检查',   hint: '检查信息是否齐全/合理' },
  { i: 3, key: 'steps',   name: '步骤拆解',   hint: '按流程生成方案' },
  { i: 4, key: 'rules',   name: '规则约束',   hint: '容量/预算等规则被校验' },
  { i: 5, key: 'output',  name: '规范输出',   hint: '输出结构化方案卡' },
  { i: 6, key: 'anomaly', name: '异常测试',   hint: '测预算超限/人数超容等异常' },
];

function ruleGrid(events) {
  const evs = Array.isArray(events) ? events : [];
  const submits = evs.filter(e => e.event === 'tool_submit');
  const checks  = evs.filter(e => e.event === 'tool_check');
  const results = evs.filter(e => e.event === 'tool_result');
  const errors  = evs.filter(e => e.event === 'tool_error');
  const grid = RULE_CELLS.map(c => ({ ...c, state: 'empty', value: '' }));

  const last = submits[submits.length - 1];
  if (last && last.payload) {
    const keys = ['theme', 'people', 'venue', 'budget', 'date', 'duration'];
    const filled = keys.filter(k => last.payload[k] && String(last.payload[k]).trim()).length;
    grid[0].state = filled >= 6 ? 'ok' : filled >= 4 ? 'rec' : filled >= 2 ? 'clarify' : 'empty';
    grid[0].value = `填了 ${filled}/6 项`;
  }

  if (checks.length) { grid[1].state = 'ok'; grid[1].value = `检查 ${checks.length} 次`; }

  if (results.length) { grid[2].state = 'ok'; grid[2].value = '方案已生成'; }

  if (checks.some(e => e.payload && e.payload.ok === false) || results.some(e => e.payload && (e.payload.warns || 0) > 0)) {
    grid[3].state = 'ok'; grid[3].value = '规则校验触发';
  }

  if (results.length) { grid[4].state = 'ok'; grid[4].value = '结构化方案卡'; }

  if (errors.length) { grid[5].state = 'ok'; grid[5].value = `测异常 ${errors.length} 次`; }

  return grid;
}

/* ========== 表 4 · 综合课 系统棱镜（5 格，事件驱动） ==========
 * 教的底层：能力与工具 —— 拆目标 → 分员工 → 选工具 → 交接 → 测试发布 */
const SYSTEM_CELLS = [
  { i: 1, key: 'goal',    name: '目标拆解',   hint: '把目标拆成可执行能力' },
  { i: 2, key: 'staff',   name: '员工分工',   hint: '为能力分配员工/职责' },
  { i: 3, key: 'tool',    name: '工具选型',   hint: '员工配置合适工具' },
  { i: 4, key: 'handoff', name: '交接设计',   hint: '设计员工间交接' },
  { i: 5, key: 'test',    name: '测试发布',   hint: '测试员工并发布' },
];

function systemGrid(events) {
  const evs = Array.isArray(events) ? events : [];
  const has = k => evs.some(e => e.event === k);
  const grid = SYSTEM_CELLS.map(c => ({ ...c, state: 'empty', value: '' }));

  if (has('abilities_generated')) { grid[0].state = 'ok'; grid[0].value = '已拆能力'; }

  const staffEv = evs.filter(e => e.event === 'employee_configured').pop();
  if (staffEv && staffEv.payload && (staffEv.payload.count || 0) > 0) {
    grid[1].state = 'ok'; grid[1].value = `配 ${staffEv.payload.count} 名员工`;
  }

  const toolEvs = evs.filter(e => e.event === 'tool_selected' && e.payload && e.payload.on !== false);
  if (toolEvs.length) { grid[2].state = 'ok'; grid[2].value = `选工具 ${toolEvs.length} 次`; }

  const handEv = evs.filter(e => e.event === 'handoff_designed').pop();
  if (handEv && handEv.payload && (handEv.payload.count || 0) > 0) {
    grid[3].state = 'ok'; grid[3].value = `${handEv.payload.count} 条交接`;
  }

  if (has('published')) { grid[4].state = 'ok'; grid[4].value = '已发布'; }
  else if (has('test_message')) { grid[4].state = 'rec'; grid[4].value = '测试中'; }

  return grid;
}

/* ========== 分发器：一核多表 ==========
 * events: [{event, payload}] —— 该任务 × 该学生的作品事件轨迹 */
const CELLS_BY_TASK = { pre: LANG_CELLS, t1: BOUNDARY_CELLS, t2: RULE_CELLS, t3: SYSTEM_CELLS };

function gridFor(task, events) {
  const evs = Array.isArray(events) ? events : [];
  if (task === 't1') return boundaryGrid(evs);
  if (task === 't2') return ruleGrid(evs);
  if (task === 't3') return systemGrid(evs);
  // pre 或未知 → 语言棱镜（从 express_submit 取原文）
  const ideaEv = evs.filter(e => e.event === 'express_submit').pop();
  return langGrid(ideaEv && ideaEv.payload ? ideaEv.payload.idea : '');
}

/* ---------- 缺口检测：guess/clarify/empty/conflict ---------- */
function detectGap(grid) {
  return (grid || []).filter(c => GAP_STATES.includes(c.state));
}

/* ---------- 缺口清单文本（后三课学生端镜子用） ---------- */
function gapText(grid) {
  const gap = detectGap(grid);
  if (!gap.length) return '没有明显缺口，可以开工。';
  return '还没立住：' + gap.map(c => `${c.name}（${STATE[c.state].label}）`).join('、') + '。';
}

/* ---------- 回读句（预备课“模型实际听到的”） ---------- */
function paraphrase(grid) {
  const okCells = grid.filter(c => c.state === 'ok' || c.state === 'rec');
  const gapCells = detectGap(grid);
  const taskCell = grid[3];
  const taskStr = taskCell && taskCell.value ? `「${taskCell.value}」` : '某件事';

  let heard = `我理解你想让 AI 帮你做 ${taskStr}`;
  if (okCells.length) {
    const parts = okCells
      .filter(c => c.i !== 4)
      .map(c => `${c.name}=${c.value}`);
    if (parts.length) heard += '，并且我已经确认了：' + parts.join('、') + '。';
  } else {
    heard += '。';
  }

  if (gapCells.length) {
    const gapStr = gapCells.map(c => {
      const s = STATE[c.state].label;
      return `${c.name}（${s}）`;
    }).join('、');
    heard += `\n\n但 ${gapStr} 你还${gapCells.some(c => c.state === 'empty') ? '没说清' : '只是推测/待澄清'}。`;
    heard += '所以我大概率会先做一个泛泛的、不贴任何人的东西，除非你补全这些格子。';
  } else {
    heard += '\n\n理解棱镜基本立住，我可以直接开工，但开工前仍建议你确认一遍。';
  }
  return heard;
}

/* ---------- 按课判定：这一课做立住了吗 ----------
 * 返回 {grid, clear, score:0-100, missing:[], gapCount} */
const CORE_CELLS = { pre: [1, 4, 5, 10], t1: [1, 2, 3], t2: [1, 2, 6], t3: [1, 2, 5] };

function clarityFor(task, events) {
  const grid = gridFor(task, events);
  const gap = detectGap(grid);
  const core = CORE_CELLS[task] || [];
  const coreMissing = grid
    .filter(c => core.includes(c.i) && ['empty', 'clarify'].includes(c.state))
    .map(c => c.name);
  const score = Math.round(grid.filter(c => c.state === 'ok' || c.state === 'rec').length / grid.length * 100);
  return { grid, clear: gap.length <= 2 && coreMissing.length === 0, score, missing: coreMissing, gapCount: gap.length };
}

/* ---------- 旧接口兼容（单文本版 = 预备课语言棱镜） ---------- */
function fillGrid(text) { return langGrid(text); }
function clarity(text) { return clarityFor('pre', [{ event: 'express_submit', payload: { idea: text } }]); }

/* ---------- 从事件 payload 提取“学生原文” ---------- */
function pickText(payload) {
  const p = payload || {};
  for (const k of ['idea', 'question', 'desc', 'goal', 'text']) {
    if (p[k] && String(p[k]).trim()) return String(p[k]).trim();
  }
  return null;
}

/* ---------- course/task → 课标 id（pre/t1/t2/t3） ---------- */
function taskIdOf(payload) {
  const p = payload || {};
  if (p.task && /^(pre|t1|t2|t3)$/.test(p.task)) return p.task;
  const map = { '0': 'pre', '1': 't1', '2': 't2', '4': 't3' };
  return map[String(p.course)] || null;
}

/* 浏览器全局导出（被 student/monitor/bigscreen 引用） */
if (typeof window !== 'undefined') {
  window.Analyzer = {
    STATE, LANG_CELLS, BOUNDARY_CELLS, RULE_CELLS, SYSTEM_CELLS, CELLS_BY_TASK,
    fillGrid, langGrid, boundaryGrid, ruleGrid, systemGrid, gridFor,
    detectGap, gapText, paraphrase, clarityFor, clarity, pickText, taskIdOf,
  };
}
if (typeof module !== 'undefined') {
  module.exports = {
    STATE, LANG_CELLS, BOUNDARY_CELLS, RULE_CELLS, SYSTEM_CELLS, CELLS_BY_TASK,
    fillGrid, langGrid, boundaryGrid, ruleGrid, systemGrid, gridFor,
    detectGap, gapText, paraphrase, clarityFor, clarity, pickText, taskIdOf,
  };
}
