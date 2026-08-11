/* ============ 方案A · 顷悟 AI 应用版学生端 ============
   核心卖点: 学生用顷悟账户登录, AI 调用走平台 SDK (pccc 自动注入, 不塞任何 key)
   埋点: 学生在页面上的每一步操作都上报到老师服务器 (demo 里落到 localStorage 供监控端演示) */

const $ = id => document.getElementById(id);
let ai = null;

/* ---------- 埋点上报 (老师监控) ----------
   正式环境: 把 ENDPOINT 改成老师服务器地址, 例如 https://your-server/api/collect
   demo 环境: 同源写 localStorage, 监控端看板直接读, 开 http 服务后即可看到实时轨迹 */
const ENDPOINT = '/api/collect';
const EVENT_KEY = 'ar_class_monitor_events';

function getSid(){
  let s = $('sid').value.trim();
  if (!s) s = '未填学号-' + Math.random().toString(36).slice(2,7);
  return s;
}
function track(event, payload={}){
  const rec = { ts: Date.now(), sid: getSid(), event, payload };
  // demo: 写 localStorage (同源共享, 监控看板轮询读)
  try {
    const arr = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
    arr.push(rec);
    if (arr.length > 2000) arr.splice(0, arr.length - 2000);
    localStorage.setItem(EVENT_KEY, JSON.stringify(arr));
  } catch(e){}
  // 正式: POST 到老师服务器 (CORS/失败不影响页面, 静默)
  try {
    fetch(ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(rec) })
      .catch(()=>{ /* 无服务器时静默 */ });
  } catch(e){}
  console.info('[埋点]', rec);
}

/* ---------- AI 调用封装 ----------
   SDK 就绪: 走 ai.chat() (顷悟平台, 消费者账户扣费)
   SDK 未就绪 (本地双击/未替换 app_id): 降级内置模拟回复, 保证 demo 能跑 */
const MOCK_REPLY = '（演示模式·SDK 未就绪）我听到你说的是：\n对象：大学生\n问题：想要一个 AI 帮忙，但说不清具体场景\n目标：一个真正有用的学习 AI\n——这三个还太模糊，我们继续补。';

async function aiChat(userText, systemHint){
  track('ai_chat_req', { text: userText, hint: systemHint || '' });
  let full = '';
  if (ai && typeof ai.chat === 'function') {
    const history = [{ role: 'user', content: userText }];
    try {
      await ai.chat(history, { stream: true, onDelta: d => { full += d; } });
      track('ai_chat_resp', { reply: full });
      return full;
    } catch (e) {
      console.warn('SDK chat 失败, 降级模拟:', e);
      track('ai_chat_err', { msg: String(e && e.message || e) });
    }
  }
  await sleep(600);
  full = MOCK_REPLY;
  track('ai_chat_resp', { reply: full, mode: 'mock' });
  return full;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 六字段 ---------- */
const FIELDS = [
  { k:'对象', ph:'谁来用？如：考研的小林' },
  { k:'问题', ph:'卡在哪？如：英语阅读总错' },
  { k:'目标', ph:'要做到啥？如：30 分钟专项训练' },
  { k:'限制', ph:'别做什么？如：不用超纲生词' },
  { k:'场景', ph:'啥时候用？如：碎片时间' },
  { k:'标准', ph:'咋算好？如：错题要给依据' },
];
const fieldVals = {};
let step = 1;

function showStep(n){
  step = n;
  document.querySelectorAll('.step').forEach(el => el.classList.toggle('on', +el.dataset.step === n));
  for (let i=1;i<=4;i++) $('pane'+i).hidden = (i !== n);
  track('step', { to: n });
}

function markChecker(k, v){
  const ck = document.querySelector('.ck[data-k="'+k+'"] b');
  if (!ck) return;
  if (v) { ck.textContent = v.length > 8 ? v.slice(0,8)+'…' : v; ck.className = 'ok'; }
  else { ck.textContent = '空'; ck.className = 'bad'; }
}

/* ---------- 主流程 ---------- */
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
  // AI 翻译: 先亮前 3 栏 (对象/问题/目标)
  renderFields();
  FIELDS.slice(0,3).forEach(f => fieldVals[f.k] = '？');
  refreshFieldsUI();
  const hint = '把学生刚才的想法翻译成结构化字段: 对象/问题/目标 (只给这3栏, 其它留空)';
  const reply = await aiChat('根据我的想法: ' + ($('idea').value.trim() || '(空)') + '，帮我翻译成对象/问题/目标三个字段', hint);
  track('ai_translate_done', { reply });
  $('btn2').disabled = false;
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

/* ---------- 顷悟 SDK 初始化 (沿用范本铁律: 登录按钮必须保留) ---------- */
(async function initSDK(){
  let APP_ID = String(window.QINGWU_APP_ID || '0');
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    try { const r = await fetch('./qingwu.json'); const j = await r.json();
      if (j && j.app_id && String(j.app_id).indexOf('<<') === -1) APP_ID = String(j.app_id); } catch(e){}
  }
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    console.warn('QINGWU_APP_ID 未注入, 使用演示模拟模式');
    return;
  }
  if (typeof window.QingwuAI !== 'function') { console.warn('SDK 未加载, 使用演示模拟模式'); return; }
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
  track('page_loaded', { plan:'A', sdk:true });
})();
