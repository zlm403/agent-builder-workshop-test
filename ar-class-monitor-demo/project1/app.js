/* ============ 项目一 · 学生端（三标签页） ============
   1. 项目看板  : 接收老师推送的任务（来自老师端 task_push）
   2. 执行面板  : 网页引导四步 + 顷悟 Agent 自由对话（对话自动同步）
   3. 数据穿透  : "你以为说的" vs "AI 听到的" 对比 + AI 复盘，全量同步老师
   埋点: 所有事件写 localStorage(同源) + POST /api/collect(正式) */

const $ = id => document.getElementById(id);
let ai = null;

/* ---------- 埋点上报 ---------- */
const ENDPOINT = '/api/collect';
const EVENT_KEY = 'ar_class_monitor_events';

function getSid(){
  let s = $('sid').value.trim();
  if (!s) s = '未填学号-' + Math.random().toString(36).slice(2,7);
  return s;
}
function readEvents(){
  try { return JSON.parse(localStorage.getItem(EVENT_KEY) || '[]'); } catch(e){ return []; }
}
function track(event, payload={}){
  const rec = { ts: Date.now(), sid: getSid(), event, payload };
  try {
    const arr = readEvents();
    arr.push(rec);
    if (arr.length > 3000) arr.splice(0, arr.length - 3000);
    localStorage.setItem(EVENT_KEY, JSON.stringify(arr));
  } catch(e){}
  try {
    fetch(ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(rec) })
      .catch(()=>{});
  } catch(e){}
  console.info('[埋点]', rec);
  return rec;
}

/* ---------- AI 调用封装（SDK 就绪走平台，否则降级模拟） ---------- */
const MOCK_REPLY = '（演示模式·SDK 未就绪）我听到你说的是：\n对象：大学生\n问题：想要一个 AI 帮忙，但说不清具体场景\n目标：一个真正有用的学习 AI\n——这三个还太模糊，我们继续补。';
const MOCK_TRANSLATE = '对象：大学生\n问题：说不清具体场景\n目标：一个真正有用的学习 AI\n限制：？\n场景：？\n标准：？';
const MOCK_AGENT = '（演示 Agent）明白了，那我们一步步来：你的 AI 是给谁用的？遇到什么问题？想达到什么效果？';
const MOCK_ANALYZE = '（演示复盘）你的原话里只出现了「大学生」和「学习 AI」，AI 只能推断出对象，其余五栏全部要靠追问。建议下次直接说清：谁用、卡在哪、要做到啥、别做什么、啥时候用、咋算好。';

async function aiChat(userText, systemHint, trackName='ai_chat'){
  track(trackName + '_req', { text: userText, hint: systemHint || '' });
  let full = '';
  if (ai && typeof ai.chat === 'function') {
    const history = [{ role: 'user', content: userText }];
    try {
      await ai.chat(history, { stream: true, onDelta: d => { full += d; } });
      track(trackName + '_resp', { reply: full });
      return full;
    } catch (e) {
      console.warn('SDK chat 失败, 降级模拟:', e);
      track(trackName + '_err', { msg: String(e && e.message || e) });
    }
  }
  await sleep(500);
  full = MOCK_REPLY;
  track(trackName + '_resp', { reply: full, mode: 'mock' });
  return full;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Tab 切换 ---------- */
const TABS = ['board', 'exec', 'xray'];
function showTab(name){
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('on', el.dataset.tab === name));
  TABS.forEach(t => $('tab-' + t).hidden = (t !== name));
  if (name === 'board') loadTask();
  if (name === 'xray') renderXray();
}
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    track('tab_switch', { to: btn.dataset.tab });
    showTab(btn.dataset.tab);
  });
});

/* ================= Tab1 项目看板 ================= */
let currentTask = null;
function loadTask(){
  const pushes = readEvents().filter(e => e.event === 'task_push');
  const latest = pushes[pushes.length - 1];
  const card = $('taskCard');
  if (!latest) {
    card.innerHTML = '<div class="task-empty">⏳ 等待老师下发任务…<br><span class="dim">老师端推送后，这里会自动出现这一步要做什么。</span></div>';
    $('btnTaskOk').disabled = true;
    currentTask = null;
    return;
  }
  currentTask = latest.payload;
  const t = currentTask;
  const meta = `推送时间 ${new Date(latest.ts).toLocaleTimeString()} · 任务 ${latest.payload.task_no || '—'}`;
  card.innerHTML = `
    <div class="task-meta">📨 ${meta}</div>
    <div class="task-title">${t.title || '课堂任务'}</div>
    <div class="task-desc">${(t.desc || '').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
    ${t.goal ? `<div class="task-goal">🎯 目标：${t.goal.replace(/</g,'&lt;')}</div>` : ''}
    ${t.steps ? `<div class="task-steps">📌 步骤：${t.steps.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}`;
  $('btnTaskOk').disabled = false;
  // 是否已确认过这个任务
  const viewed = readEvents().filter(e => e.event === 'task_view' && e.payload && e.payload.task_ts === latest.ts);
  if (viewed.length) {
    $('btnTaskOk').textContent = '✓ 已确认收到';
    $('btnTaskOk').disabled = true;
    $('taskHint').textContent = '已通知老师，去执行面板开工吧';
  } else {
    $('btnTaskOk').textContent = '✓ 收到，开始执行';
  }
}
$('btnTaskOk').addEventListener('click', () => {
  if (!currentTask) return;
  track('task_view', { task_ts: currentTask._ts, task_no: currentTask.task_no || '', title: currentTask.title || '' });
  $('btnTaskOk').textContent = '✓ 已确认收到';
  $('btnTaskOk').disabled = true;
  $('taskHint').textContent = '已通知老师，去执行面板开工吧';
  showTab('exec');
});

/* ================= Tab2 执行面板 ================= */
/* ---- 模式切换：网页 ／ Agent ---- */
function setMode(m){
  document.querySelectorAll('.mode').forEach(el => el.classList.toggle('on', el.dataset.mode === m));
  $('mode-web').hidden = (m !== 'web');
  $('mode-agent').hidden = (m !== 'agent');
  track('exec_mode', { mode: m });
}
document.querySelectorAll('.mode').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

/* ---- 网页四步（沿用方案A流程，事件名与监控端兼容） ---- */
const FIELDS = [
  { k:'对象', ph:'谁来用？如：考研的小林' },
  { k:'问题', ph:'卡在哪？如：英语阅读总错' },
  { k:'目标', ph:'要做到啥？如：30 分钟专项训练' },
  { k:'限制', ph:'别做什么？如：不用超纲生词' },
  { k:'场景', ph:'啥时候用？如：碎片时间' },
  { k:'标准', ph:'咋算好？如：错题要给依据' },
];
const fieldVals = {};

function showStep(n){
  document.querySelectorAll('.step').forEach(el => el.classList.toggle('on', +el.dataset.step === n));
  for (let i=1;i<=4;i++) $('pane'+i).hidden = (i !== n);
  track('step', { to: n });
}
function markChecker(k, v){
  const ck = document.querySelector('#mode-web .ck[data-k="'+k+'"] b');
  if (!ck) return;
  if (v) { ck.textContent = v.length > 8 ? v.slice(0,8)+'…' : v; ck.className = 'ok'; }
  else { ck.textContent = '空'; ck.className = 'bad'; }
}

$('btn1').addEventListener('click', async () => {
  const idea = $('idea').value.trim();
  if (!idea) { alert('先写一句你的想法吧'); return; }
  track('idea_submit', { idea });
  $('btn1').disabled = true; $('btn1').textContent = '生成中…';
  showStep(2);
  $('genBox').innerHTML = '<span class="dim">（AI 正在生成第一版…）</span>';
  const reply = await aiChat(idea, '你是课堂教练: 先复述学生的模糊想法, 不点评');
  $('genBox').textContent = reply;
  $('btn1').disabled = false; $('btn1').textContent = '▶ 提交给 AI';
});

$('btn2').addEventListener('click', async () => {
  track('ai_translate_click', {});
  $('btn2').disabled = true;
  renderFields();
  FIELDS.slice(0,3).forEach(f => fieldVals[f.k] = '？');
  refreshFieldsUI();
  $('btn2').textContent = '翻译中…';
  let reply;
  if (ai && typeof ai.chat === 'function') {
    reply = await aiChat('根据我的想法: ' + ($('idea').value.trim() || '(空)') + '，帮我翻译成对象/问题/目标三个字段，其余留空', '把学生想法翻译成结构化字段: 对象/问题/目标');
  } else {
    track('ai_chat_req', { text: 'translate' });
    await sleep(500);
    reply = MOCK_TRANSLATE;
    track('ai_chat_resp', { reply, mode: 'mock' });
  }
  track('ai_translate_done', { reply });
  // 尝试解析字段回填
  FIELDS.forEach(f => {
    const m = reply.match(new RegExp(f.k + '[:：]\\s*([^\\n]+)'));
    if (m && m[1] && m[1].trim() !== '？' && m[1].trim() !== '空') fieldVals[f.k] = m[1].trim();
  });
  refreshFieldsUI();
  $('btn2').disabled = false; $('btn2').textContent = '🔁 让 AI 帮我翻译（先给最核心的 3 栏）';
});

function renderFields(){
  $('fields').innerHTML = FIELDS.map(f =>
    `<div class="fld"><span class="k">${f.k}</span><input data-k="${f.k}" placeholder="${f.ph}" value="${fieldVals[f.k] || ''}"></div>`
  ).join('');
  $('fields').querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      fieldVals[inp.dataset.k] = inp.value.trim();
      markChecker(inp.dataset.k, inp.value.trim());
    });
  });
}
function refreshFieldsUI(){
  $('fields').querySelectorAll('input').forEach(inp => {
    inp.value = fieldVals[inp.dataset.k] || '';
    markChecker(inp.dataset.k, fieldVals[inp.dataset.k] || '');
  });
}

$('btn3').addEventListener('click', async () => {
  const filled = FIELDS.filter(f => fieldVals[f.k] && fieldVals[f.k] !== '？').length;
  track('fields_filled', { total: FIELDS.length, filled, values: {...fieldVals} });
  if (filled < FIELDS.length) { if(!confirm('还有 ' + (FIELDS.length-filled) + ' 栏没填，直接进入回读吗？')) return; }
  showStep(4);
  $('readbackBox').innerHTML = '<span class="dim">（AI 正在回读它理解的内容…）</span>';
  const snapshot = FIELDS.map(f => `${f.k}：${fieldVals[f.k] || '（空）'}`).join('\n');
  const reply = await aiChat('请把你理解的我的项目回读一遍, 按字段逐条列出, 最后问: 以上理解对吗? 内容:\n' + snapshot, '你是回读器: 只回读, 不补充');
  $('readbackBox').textContent = reply;
});
$('btn3b').addEventListener('click', async () => {
  track('ai_ask_more', {});
  const reply = await aiChat('我还有哪些地方没说清? 请一个问题一个问题问我, 不要一次问完', '你是提问教练: 一次只问一个最关键的问题');
  $('fields').insertAdjacentHTML('beforeend', `<div class="box ai" style="margin-top:10px">${reply.replace(/</g,'&lt;')}</div>`);
});

$('btn4').addEventListener('click', () => {
  track('readback_confirm', {});
  $('pane4').querySelector('.row').hidden = true;
  $('doneBox').hidden = false;
  track('finish', { card: 'AI 创造第一原则卡' });
});
$('btn4b').addEventListener('click', () => {
  track('readback_reject', {});
  showStep(3);
});

/* ---- 模式B：顷悟 Agent 自由对话（自动同步演示） ---- */
const agentLog = [];
$('btnAgent').addEventListener('click', async () => {
  const text = $('agentInput').value.trim();
  if (!text) return;
  $('agentInput').value = '';
  const req = { text, at: Date.now() };
  track('agent_dialog_req', { text, channel: 'qingwu-agent' });
  agentLog.push({ role: 'user', text });
  renderAgentChat();
  await sleep(700);
  let reply = MOCK_AGENT;
  if (ai && typeof ai.chat === 'function') {
    reply = await aiChat(text, '你是顷悟 Agent 课堂教练: 用提问引导学员说清需求', 'agent_dialog');
  }
  track('agent_dialog_resp', { reply, channel: 'qingwu-agent' });
  agentLog.push({ role: 'ai', text: reply });
  renderAgentChat();
});
$('agentInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnAgent').click(); });

function renderAgentChat(){
  if (!agentLog.length) { $('agentChat').innerHTML = '<div class="dim">（通道已就绪，等待第一轮对话…）</div>'; return; }
  $('agentChat').innerHTML = agentLog.map(m =>
    m.role === 'user'
      ? `<div class="msg user"><span class="who">你</span>${m.text.replace(/</g,'&lt;')}</div>`
      : `<div class="msg ai"><span class="who">Agent</span>${m.text.replace(/</g,'&lt;')}</div>`
  ).join('');
  $('agentCount').textContent = agentLog.filter(m => m.role === 'user').length;
}

/* ================= Tab3 数据穿透看板 ================= */
function myEvents(){
  const sid = getSid();
  return readEvents().filter(e => e.sid === sid);
}
function renderXray(){
  const evs = myEvents();
  const ideaEv = evs.filter(e => e.event === 'idea_submit').pop();
  const transEv = evs.filter(e => e.event === 'ai_translate_done').pop();
  const fieldsEv = evs.filter(e => e.event === 'fields_filled').pop();
  const agentReqs = evs.filter(e => e.event === 'agent_dialog_req');
  const agentResps = evs.filter(e => e.event === 'agent_dialog_resp');

  // 原话
  $('xrIdea').textContent = ideaEv ? ideaEv.payload.idea : '（先在执行面板提交想法）';

  // AI 结构化理解（优先翻译结果解析，其次字段值）
  const understood = {};
  FIELDS.forEach(f => understood[f.k] = '');
  if (transEv) {
    FIELDS.forEach(f => {
      const m = transEv.payload.reply.match(new RegExp(f.k + '[:：]\\s*([^\\n]+)'));
      if (m && m[1]) understood[f.k] = m[1].trim();
    });
  }
  if (fieldsEv) {
    Object.assign(understood, fieldsEv.payload.values || {});
  }
  FIELDS.forEach(f => {
    const el = document.querySelector('#tab-xray .ck[data-k="'+f.k+'"] b');
    const v = understood[f.k] && understood[f.k] !== '？' ? understood[f.k] : '';
    if (el) {
      if (v) { el.textContent = v.length > 12 ? v.slice(0,12)+'…' : v; el.className = 'ok'; }
      else { el.textContent = '空'; el.className = 'bad'; }
    }
  });

  // 缺口
  const gaps = FIELDS.filter(f => !(understood[f.k] && understood[f.k] !== '？'));
  if (gaps.length) {
    $('gapBox').hidden = false;
    $('gapList').innerHTML = gaps.map(g =>
      `<span class="gap-chip">${g.k}</span>`).join('');
  } else $('gapBox').hidden = true;

  // Agent 对话记录
  if (agentReqs.length) {
    $('agentLogBox').hidden = false;
    const rows = [];
    agentReqs.forEach((r, i) => {
      rows.push(`<div class="msg user"><span class="who">你</span>${(r.payload.text||'').replace(/</g,'&lt;')}</div>`);
      const resp = agentResps[i];
      if (resp) rows.push(`<div class="msg ai"><span class="who">Agent</span>${(resp.payload.reply||'').replace(/</g,'&lt;')}</div>`);
    });
    $('agentLog').innerHTML = rows.join('');
  } else $('agentLogBox').hidden = true;

  // 切换时也更新计数
  $('agentCount').textContent = agentReqs.length;
}

/* 生成复盘点评 */
$('btnAnalyze').addEventListener('click', async () => {
  track('penetration_analyze_click', {});
  $('btnAnalyze').disabled = true; $('btnAnalyze').textContent = '分析中…';
  $('analyzeBox').hidden = false;
  $('analyzeBox').innerHTML = '<span class="dim">（AI 正在复盘你的表达…）</span>';
  let reply;
  if (ai && typeof ai.chat === 'function') {
    const evs = myEvents();
    const ideaEv = evs.filter(e => e.event === 'idea_submit').pop();
    reply = await aiChat('这是我的原话: ' + (ideaEv ? ideaEv.payload.idea : '(无)') + '。请复盘我哪里没表达清楚、AI 可能误解什么、下次怎么改。', '你是表达复盘教练: 指出原话的模糊点, 给出具体修改建议');
  } else {
    await sleep(600);
    reply = MOCK_ANALYZE;
  }
  track('penetration_analysis', { summary: reply });
  $('analyzeBox').textContent = reply;
  $('btnAnalyze').disabled = false; $('btnAnalyze').textContent = '🧠 生成 AI 复盘点评';
});

/* ---------- 顷悟 SDK 初始化（沿用范本铁律: 登录按钮必须保留） ---------- */
(async function initSDK(){
  let APP_ID = String(window.QINGWU_APP_ID || '0');
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    try { const r = await fetch('./qingwu.json'); const j = await r.json();
      if (j && j.app_id && String(j.app_id).indexOf('<<') === -1) APP_ID = String(j.app_id); } catch(e){}
  }
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    console.warn('QINGWU_APP_ID 未注入, 使用演示模拟模式');
    track('page_loaded', { page: 'project1', sdk: false });
    return;
  }
  if (typeof window.QingwuAI !== 'function') { console.warn('SDK 未加载, 使用演示模拟模式'); track('page_loaded', { page: 'project1', sdk: false }); return; }
  ai = new QingwuAI({ appId: APP_ID });
  ai.on('onUnauthenticated', () => updateLoginState(false));
  ai.on('onInsufficientBalance', () => alert('账户余额不足'));
  const loginBtn = $('loginBtn');
  function updateLoginState(ok){
    loginBtn.textContent = ok ? '已登录' : '未登录 · 点击登录';
    loginBtn.className = 'login-btn' + (ok ? ' on' : '');
  }
  updateLoginState(ai.isLoggedIn());
  loginBtn.addEventListener('click', async () => {
    try { await ai.requireLogin(); updateLoginState(true); track('login', { ok:true }); }
    catch(e){ track('login', { ok:false }); }
  });
  track('page_loaded', { page: 'project1', sdk: true });
})();

/* ---------- 启动 ---------- */
showTab('board');
setMode('web');
loadTask();
setInterval(loadTask, 4000);          // 轮询老师推送的新任务
window.addEventListener('storage', loadTask); // 同源实时
