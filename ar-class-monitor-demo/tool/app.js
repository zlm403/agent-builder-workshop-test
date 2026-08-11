/* ============ 第二课作品 · 校园活动方案生成器 ============
   教学点：流程与规则（从回答问题到完成服务）
   1. 收集输入：表单收集活动信息
   2. 检查信息：必填缺失 → 追问（不生成）
   3. 拆解步骤：按 planTemplates 生成环节
   4. 设置规则：场地容量 / 人均预算 约束
   5. 规范输出：标准方案格式 + 复制
   6. 测试异常：乱输入 / 超容量 / 预算不足
   埋点：tool_submit / tool_check / tool_result / tool_error */

Track.config({ endpoint: '/api/collect', page: 'lesson2-tool', course: '2' });

const $ = id => document.getElementById(id);
const CFG = window.TOOL_CONFIG || {};
const VENUES = CFG.venues || [];
const TEMPLATES = CFG.planTemplates || [];

/* ---------- Tab ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === btn));
    ['make', 'test', 'rules'].forEach(p => $('#' + p).hidden = (p !== btn.dataset.panel));
    if (btn.dataset.panel === 'rules') renderRules();
    if (btn.dataset.panel === 'test') renderTests();
  });
});

/* ---------- 场地下拉 ---------- */
(function initVenue(){
  $('fVenue').innerHTML = VENUES.map(v => `<option value="${v.name}">${v.name}（容量 ${v.capacity}）</option>`).join('') || '<option>未配置场地</option>';
})();

/* ---------- 检查信息（返回问题数组；没有则 null） ---------- */
function checkInfo(){
  const problems = [];
  const theme = $('fTheme').value.trim();
  const date = $('fDate').value.trim();
  const peopleRaw = $('fPeople').value.trim();
  const venue = $('fVenue').value;
  const budgetRaw = $('fBudget').value.trim();
  const duration = $('fDuration').value;

  if (!theme) problems.push('活动主题还没填');
  if (!date) problems.push('活动日期还没填');
  if (!peopleRaw) problems.push('参与人数还没填');
  else if (!/^\d+$/.test(peopleRaw)) problems.push('参与人数不是数字（请填写数字，如 300）');
  if (!budgetRaw) problems.push('预算还没填');
  else if (!/^\d+$/.test(budgetRaw)) problems.push('预算不是数字（请填写数字，如 10000）');

  const info = { theme, date, peopleRaw, venue, budgetRaw, duration };
  if (problems.length) return { problems, info, ok: false };

  const people = parseInt(peopleRaw, 10);
  const budget = parseInt(budgetRaw, 10);
  const v = VENUES.find(v => v.name === venue);
  if (v && people > v.capacity) {
    problems.push(`人数（${people}）超过${venue}容量（${v.capacity}），请换场地或减人数`);
  }
  const minBudget = people * (CFG.minBudgetPerHead || 20);
  if (budget < minBudget) {
    problems.push(`预算偏低：${people} 人按人均 ${CFG.minBudgetPerHead} 元，至少需要 ${minBudget} 元`);
  }
  info.people = people; info.budget = budget;
  if (problems.length) return { problems, info, ok: false };
  return { problems: [], info, ok: true };
}

/* ---------- 生成方案 ---------- */
$('btnGen').addEventListener('click', () => {
  const res = checkInfo();
  Track.event('tool_submit', {
    theme: res.info.theme, people: res.info.peopleRaw, venue: res.info.venue,
    budget: res.info.budgetRaw, date: res.info.date, duration: res.info.duration, ok: res.ok,
    desc: `做一场「${res.info.theme}」校园活动，${res.info.date}，约 ${res.info.peopleRaw} 人参加，场地 ${res.info.venue}，预算 ${res.info.budgetRaw} 元，时长 ${res.info.duration}`
  });
  const check = $('checkBox');
  const plan = $('planBox');
  if (!res.ok) {
    check.hidden = false;
    check.className = 'check-box bad';
    check.innerHTML = '<b>⚠️ 信息检查未通过：</b><ul>' + res.problems.map(p => `<li>${p.replace(/</g,'&lt;')}</li>`).join('') + '</ul>';
    plan.hidden = true;
    Track.event('tool_check', { ok: false, problems: res.problems });
    return;
  }
  check.hidden = true;
  const warns = [];
  const v = VENUES.find(v => v.name === res.info.venue);
  if (v && res.info.people > v.capacity * 0.8) warns.push(`接近 ${v.name} 容量上限（${v.capacity}），建议控制报名或分场次`);
  if (res.info.budget < res.info.people * (CFG.minBudgetPerHead || 20) * 1.5) warns.push('预算偏紧，应急预留建议提高');

  const i = res.info;
  const supplyItems = [
    `桌椅 ${Math.ceil(i.people / 4)} 套`,
    `饮用水 ${Math.ceil(i.people * 1.5)} 瓶`,
    '音响 + 话筒 1 套',
    `宣传物料（海报/横幅）`,
    `急救包 2 个`
  ];
  const budgetLines = [
    ['物料采购', Math.round(i.budget * 0.4)],
    ['场地布置', Math.round(i.budget * 0.2)],
    ['宣传制作', Math.round(i.budget * 0.15)],
    ['人员/嘉宾', Math.round(i.budget * 0.1)],
    ['应急预留', Math.round(i.budget * 0.15)]
  ];
  const teamSplit = [
    `策划组 ${Math.max(2, Math.round(i.people * 0.03))} 人`,
    `宣传组 ${Math.max(2, Math.round(i.people * 0.02))} 人`,
    `物资组 ${Math.max(2, Math.round(i.people * 0.02))} 人`,
    `现场组 ${Math.max(3, Math.round(i.people * 0.05))} 人`,
    `应急组 ${Math.max(2, Math.round(i.people * 0.01))} 人`
  ];

  $('planTitle').textContent = `${CFG.planHeader || '【校园活动方案】'} ${i.theme}`;
  $('planBody').innerHTML = `
    <div class="p-meta">📅 ${i.date} · 🏟 ${i.venue} · 👥 ${i.people} 人 · 💰 ${i.budget} 元 · ⏱ ${i.duration}</div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[0].title}</div><div>${TEMPLATES[0].desc}：提前 ${i.duration === '两天' ? 14 : 7} 天启动</div></div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[1].title}</div><div>${TEMPLATES[1].desc}（${i.duration}）</div></div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[2].title}</div><div>${supplyItems.join('、')}</div></div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[3].title}</div><div>${teamSplit.join('；')}</div></div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[4].title}</div><div>${budgetLines.map(b => `${b[0]}：${b[1].toLocaleString()} 元`).join('；')}</div></div>
    <div class="p-section"><div class="p-sec-t">${TEMPLATES[5].title}</div><div>${TEMPLATES[5].desc}（${i.venue} 预案 + 天气预案 + 医疗点）</div></div>`;
  $('planWarns').innerHTML = warns.length ? warns.map(w => `<div class="warn">⚠️ ${w.replace(/</g,'&lt;')}</div>`).join('') : '';
  plan.hidden = false;
  Track.event('tool_result', { theme: i.theme, people: i.people, budget: i.budget, warns: warns.length });
});

$('btnCopy').addEventListener('click', () => {
  const txt = $('planTitle').textContent + '\n' + $('planBody').innerText;
  try { navigator.clipboard.writeText(txt); alert('已复制方案'); }
  catch(e){ prompt('复制以下内容：', txt); }
});

/* ---------- 异常测试 ---------- */
function renderTests(){
  const cases = [
    { name: '信息不全', desc: '什么都不填直接点生成', fill: {} },
    { name: '人数乱填', desc: '人数填 "abc"', fill: { people: 'abc', theme: '迎新晚会', date: '2026-09-20', venue: '礼堂', budget: '10000' } },
    { name: '超容量', desc: '体育馆装 3000 人', fill: { theme: '迎新晚会', date: '2026-09-20', people: '3000', venue: '体育馆', budget: '80000' } },
    { name: '预算不足', desc: '300 人只给 3000 元', fill: { theme: '迎新晚会', date: '2026-09-20', people: '300', venue: '礼堂', budget: '3000' } }
  ];
  $('testCases').innerHTML = cases.map((c, idx) => `
    <div class="tcase">
      <div><b>${c.name}</b> <span class="dim">— ${c.desc}</span></div>
      <button class="ghost" data-idx="${idx}" type="button">跑一遍</button>
    </div>`).join('');
  $('testCases').querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => runCase(cases[+b.dataset.idx]));
  });
}
function runCase(c){
  $('fTheme').value = c.fill.theme || '';
  $('fDate').value = c.fill.date || '';
  $('fPeople').value = c.fill.people || '';
  if (c.fill.venue) $('fVenue').value = c.fill.venue;
  $('fBudget').value = c.fill.budget || '';
  $('btnGen').click();
  const out = $('testOut');
  out.hidden = false;
  out.className = 'bt-result info';
  out.innerHTML = `<b>🧪 测试用例「${c.name}」</b><br><span class="dim">${c.desc} —— 观察上面生成器的反应（应拦截或给出提示，而不是乱出方案）。</span>`;
  Track.event('tool_error', { test: c.name, desc: c.desc });
}

/* ---------- 规则展示 ---------- */
function renderRules(){
  $('rulesIntro').textContent = CFG.intro || '';
  $('rulesList').innerHTML = `
    <div class="r-item"><b>🏟 场地与容量</b>${VENUES.map(v => `${v.name}(${v.capacity})`).join('、')}</div>
    <div class="r-item"><b>💰 人均预算下限</b>${CFG.minBudgetPerHead || 20} 元/人</div>
    <div class="r-item"><b>📋 方案环节</b>${TEMPLATES.map(t => t.title).join(' → ')}</div>`;
}

/* ---------- 启动 ---------- */
renderRules();
renderTests();
Track.event('page_loaded', { page: 'lesson2-tool' });
