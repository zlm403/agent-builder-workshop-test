/* ============ 方案B · 自写前端版学生端 ============
   核心卖点: 无平台登录, 学生打开即用; AI 回复走自己的后端/网关 (demo 用内置模拟);
   埋点完全自己掌控: 每个动作、每次输入、每次 AI 回复都上报 (本地 localStorage + 可选服务器) */

const $ = id => document.getElementById(id);

/* ---------- 埋点上报 (老师监控) ----------
   正式环境: 把 ENDPOINT 指向你的服务器 (可接任意后端: Node/Python/顷悟网关转发)
   demo 环境: 同源写 localStorage, 监控看板实时读 */
const ENDPOINT = '/api/collect';
const EVENT_KEY = 'ar_class_monitor_events';

function getSid(){
  let s = $('sid').value.trim();
  if (!s) s = '未填学号-' + Math.random().toString(36).slice(2,7);
  return s;
}
function track(event, payload={}){
  const rec = { ts: Date.now(), sid: getSid(), event, payload };
  try {
    const arr = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
    arr.push(rec);
    if (arr.length > 2000) arr.splice(0, arr.length - 2000);
    localStorage.setItem(EVENT_KEY, JSON.stringify(arr));
  } catch(e){}
  try {
    fetch(ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(rec) })
      .catch(()=>{});
  } catch(e){}
  console.info('[埋点]', rec);
}

/* ---------- AI 调用 (自控) ----------
   demo: 内置模拟回复 (规则+延迟, 更像真 AI)
   正式: 把 callAI 换成你自己的后端接口, 例如 fetch('/api/ai', {body: JSON.stringify({...})})
   注意: 前端不要塞任何 apiKey; key 放自己后端 */
const SIM = {
  idea:  '（演示 AI）我听到你想做「帮大学生学习的 AI」。我先复述一下：\n对象：大学生\n问题：需要一个 AI，但具体卡在哪还没说清\n目标：真正有用\n——嗯，这版太泛了，我们拆开看。',
  translate: '（演示 AI）翻译你的想法：\n对象：？谁来用\n问题：？卡在哪\n目标：？要做到啥\n——这三栏是核心，先想清楚。',
  ask:   '（演示 AI）你还有哪儿没说清？我先问一个：\n「这个 AI 是给谁用？大学生也分很多种——大一新生？考研的？还是毕业设计？」',
  readback: '（演示 AI）我理解你的项目：\n对象：考研的小林\n目标：30 分钟英语阅读专项训练\n限制：不用超纲生词\n以上理解对吗？请确认。'
};
async function callAI(kind){
  track('ai_call', { kind });
  await new Promise(r => setTimeout(r, 500 + Math.random()*500));
  const reply = SIM[kind] || SIM.idea;
  track('ai_resp', { kind, reply });
  return reply;
}

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
  $('genBox').textContent = await callAI('idea');
  $('btn1').disabled = false; $('btn1').textContent = '▶ 提交给 AI';
});

$('btn2').addEventListener('click', async () => {
  track('ai_translate_click', {});
  $('btn2').disabled = true;
  renderFields();
  FIELDS.slice(0,3).forEach(f => fieldVals[f.k] = '？');
  refreshFieldsUI();
  const reply = await callAI('translate');
  $('genBox').textContent = reply;
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
  const reply = await callAI('readback');
  $('readbackBox').textContent = reply + '\n\n（以上为演示模拟，正式版回读你填的真实内容）';
});
$('btn3b').addEventListener('click', async () => {
  track('ai_ask_more', {});
  const reply = await callAI('ask');
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

/* 页面加载埋点 */
track('page_loaded', { plan:'B', mode:'self-hosted' });
