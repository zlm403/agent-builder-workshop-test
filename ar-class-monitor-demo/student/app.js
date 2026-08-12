/* ============ 课堂工作台 · 学生端（通用壳） ============
   职责:
   1. 项目切换（项目一·接金币游戏 / 项目二·心情电量 / 项目三·内心戏）
   2. 任务看板：接收老师按项目推送的任务 + "和老师聊"对话框
   3. 本课引导：提示去顷悟 APP 对话开工
   4. 我的学习水位：6 大知识点水杯（点击看 AI 分析）
   与 AI 的对话在顷悟 APP 内完成（每个项目一个顷悟应用），本页不嵌对话通道。
   埋点: lib/track.js（POST /api/collect + localStorage 双写） */

const $ = id => document.getElementById(id);

/* ---------- 项目配置（对应课程方案.md 三项目） ---------- */
const COURSES = {
  '1': {
    name: '项目一 · 接金币游戏', icon: '🎮',
    app: '接金币游戏',
    goal: '一句话做成 → 跑 → 改 → 上传',
    guide: [
      '打开顷悟 APP，进入「接金币游戏」应用',
      '一句话告诉 AI 你想要什么游戏，先做出最小的版本，立刻跑起来',
      '边玩边改：哪里不好玩，把话说清楚让 AI 改，再跑一遍',
      '跑通了就上传发布，发布链接记下来，数据自动同步老师'
    ],
  },
  '2': {
    name: '项目二 · 心情电量', icon: '🔋',
    app: '心情电量',
    goal: '记录心情 → 存起来 → 画出电量曲线 + 小结',
    guide: [
      '打开顷悟 APP，进入「心情电量」应用',
      '设计输入：让它先问你、把信息收齐（心情、电量值），信息不全就追问',
      '把记录存起来：设置规则，让 AI 按流程处理、规范化输出',
      '画出电量曲线和小结，发布到平台——使用数据自动上报给老师'
    ],
  },
  '4': {
    name: '项目三 · 内心戏', icon: '🤖',
    app: '内心戏（懂你的 AI）',
    goal: '搭骨架 → 接入 AI → 让它读懂你',
    guide: [
      '打开顷悟 APP，进入「内心戏」应用',
      '搭骨架：定人设、定界面，接入内置 AI——先让 AI 自己干起来',
      '让它读懂你：观察你的表达、复述确认、把你说不出的话讲出来',
      '发布到平台，和朋友互相体验作品——数据自动上报给老师'
    ],
  }
};
let course = '1';

/* ---------- 初始化埋点 ---------- */
Track.config({ endpoint: '/api/collect', course: course, page: 'student-workbench' });

/* ---------- 上课号签到（号码即身份：老师课前录入本场次有效号码池，学生拿号来签到） ---------- */
function sidStorage(){
  try { return JSON.parse(localStorage.getItem('ar_class_monitor_sid_info') || 'null'); } catch(e){ return null; }
}
function applySid(sid){
  localStorage.setItem('ar_class_monitor_sid', sid);
  try { localStorage.setItem('ar_class_monitor_sid_info', JSON.stringify({ no: sid, name: '' })); } catch(e){}
  Track.config({ sid: sid });
  $('sidNo').value = sid;
  $('sidHint').textContent = '✅ 已签到：' + sid + '（本机记住，重开免签）';
  $('sidNo').disabled = true;
  $('btnSidSubmit').disabled = true;
  refreshChat();   // 签到后立即加载与老师的对话
}
function bindSid(){
  const saved = sidStorage();
  const tryLocal = () => {
    if (saved && saved.no) {
      applySid(saved.no);
      return true;
    }
    return false;
  };
  // 校验本机身份是否仍是当前场次有效上课号（换场次/号被作废后自动放开重新签）
  fetch('/api/identity', { cache: 'no-store' }).then(r => r.json()).then(ident => {
    if (ident && ident.valid && ident.sid && (!saved || saved.no === ident.sid)) {
      applySid(ident.sid);
    } else {
      clearLocalSid();
      $('sidNo').disabled = false;
      $('btnSidSubmit').disabled = false;
      $('sidHint').textContent = '输入老师发的上课号签到（一个号只能用一次）';
    }
  }).catch(() => {
    // 连不上服务器：本机有记录就先用着，没有就让输入
    if (!tryLocal()) {
      $('sidHint').textContent = '⚠️ 连不上服务器（老师端的服务没开？）';
    }
  });
}
function clearLocalSid(){
  try { localStorage.removeItem('ar_class_monitor_sid'); } catch(e){}
  try { localStorage.removeItem('ar_class_monitor_sid_info'); } catch(e){}
}
function submitSid(){
  const number = $('sidNo').value.trim();
  if (!number) { $('sidHint').textContent = '⚠️ 先输入上课号'; return; }
  $('sidHint').textContent = '⏳ 签到中…';
  fetch('/api/admit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: number })
  }).then(r => r.json()).then(res => {
    if (res.ok) {
      applySid(res.sid);
      Track.event('sid_set', { sid: res.sid, no: res.sid });
    } else {
      $('sidHint').textContent = '❌ ' + (res.reason || '签到失败');
    }
  }).catch(() => {
    $('sidHint').textContent = '⚠️ 连不上服务器（老师端的服务没开？）';
  });
}
$('btnSidSubmit').addEventListener('click', submitSid);
$('sidNo').addEventListener('keydown', e => { if (e.key === 'Enter') submitSid(); });

/* ---------- 课程切换 ---------- */
function renderCourse(){
  const c = COURSES[course];
  document.querySelectorAll('.course').forEach(el => el.classList.toggle('on', el.dataset.course === course));
  $('guideCourse').textContent = '—— ' + c.icon + ' ' + c.name + '（' + c.app + '）';
  $('guideList').innerHTML = c.guide.map((g, i) =>
    `<li><b>${i+1}.</b> ${g.replace(/</g,'&lt;')}</li>`
  ).join('');
  loadTask();
}
document.querySelectorAll('.course').forEach(btn => {
  btn.addEventListener('click', () => {
    course = btn.dataset.course;
    Track.config({ course });
    Track.event('course_switch', { course, name: COURSES[course].name });
    renderCourse();
  });
});

/* ---------- 任务看板 ---------- */
const TASK_EVENT_KEY = 'ar_class_monitor_task';
let currentTask = null;

function pickTask(events){
  // 优先当前课的任务；无课标的任务也可显示
  const mine = events.filter(e => e.event === 'task_push' && (!e.payload.course || e.payload.course === course));
  const latest = mine[mine.length - 1];
  return latest || null;
}
function renderTask(){
  const card = $('taskCard');
  const btn = $('btnTaskOk');
  if (!currentTask) {
    card.innerHTML = '<div class="task-empty">⏳ 等待老师下发任务…<br><span class="dim">老师端推送后，这里会自动出现这一步要做什么。</span></div>';
    btn.disabled = true;
    $('taskHint').textContent = '点「收到」后老师能看到你已开始';
    $('taskCourseTag').textContent = '';
    return;
  }
  const t = currentTask.payload;
  const courseName = COURSES[t.course] ? COURSES[t.course].name : (t.course || '本课');
  const meta = `推送 ${new Date(currentTask.ts).toLocaleTimeString()} · ${t.task_no || '任务'} · ${courseName}`;
  card.innerHTML = `
    <div class="task-meta">📨 ${meta.replace(/</g,'&lt;')}</div>
    <div class="task-title">${(t.title || '课堂任务').replace(/</g,'&lt;')}</div>
    <div class="task-desc">${(t.desc || '').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
    ${t.goal ? `<div class="task-goal">🎯 目标：${t.goal.replace(/</g,'&lt;')}</div>` : ''}
    ${t.steps ? `<div class="task-steps">📌 步骤：${t.steps.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}`;
  $('taskCourseTag').textContent = '（' + courseName + '）';
  const viewed = readLocalEvents().filter(e => e.event === 'task_view' && e.payload && e.payload.task_ts === currentTask.ts);
  if (viewed.length) {
    btn.textContent = '✓ 已确认收到';
    btn.disabled = true;
    $('taskHint').textContent = '已通知老师，去顷悟 APP 开工吧';
  } else {
    btn.textContent = '✓ 收到，开始执行';
    btn.disabled = false;
  }
}
function readLocalEvents(){
  try { return JSON.parse(localStorage.getItem('ar_class_monitor_events') || '[]'); } catch(e){ return []; }
}
async function loadTask(){
  // 1) localStorage 任务槽（老师刚推的，秒读）
  let events = [];
  try { const t = JSON.parse(localStorage.getItem(TASK_EVENT_KEY) || 'null'); if (t) events.push(t); } catch(e){}
  // 2) 服务端 task_push（历史 + 多课）
  try {
    const r = await fetch('/api/events?since=0', { cache: 'no-store' });
    if (r.ok) {
      const all = await r.json();
      events = events.concat(all.filter(e => e.event === 'task_push'));
    }
  } catch(e){}
  // 去重（按 ts+sid+event）
  const seen = new Set();
  events = events.filter(e => {
    const k = [e.ts, e.sid, e.event].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a,b) => (a.ts||0) - (b.ts||0));
  currentTask = pickTask(events);
  renderTask();
}
$('btnTaskOk').addEventListener('click', () => {
  if (!currentTask) return;
  Track.event('task_view', { task_ts: currentTask.ts, task_no: currentTask.payload.task_no || '', title: currentTask.payload.title || '', course });
  $('btnTaskOk').textContent = '✓ 已确认收到';
  $('btnTaskOk').disabled = true;
  $('taskHint').textContent = '已通知老师，去顷悟 APP 开工吧';
});

/* ---------- 和老师聊天（学生提问 → 老师回复，双向对话） ---------- */
let chatMsgs = [];   // {role:'me'|'teacher', text, ts}
let chatSeenCount = 0;   // 已读消息数（用于新消息提醒）
function mySid(){
  return (localStorage.getItem('ar_class_monitor_sid') || '').trim();
}
function renderChat(){
  const log = $('chatLog');
  if (!log) return;
  if (!chatMsgs.length) { log.innerHTML = '<div class="chat-empty">还没有消息，遇到问题就发一条吧</div>'; return; }
  log.innerHTML = chatMsgs.map(m => {
    const mine = m.role === 'me';
    return `<div class="chat-msg ${mine ? 'me' : 'teacher'}"><div class="bubble">${m.text.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div></div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
}
async function refreshChat(){
  const sid = mySid();
  if (!sid) return;
  try {
    const r = await fetch('/api/events?since=0', { cache: 'no-store' });
    if (!r.ok) return;
    const all = await r.json();
    // 我的消息：我发的 student_ask + 老师回我的 teacher_reply（sid=我的号）
    const mine = all.filter(e => e.sid === sid && (e.event === 'student_ask' || e.event === 'teacher_reply'));
    const msgs = mine.sort((a,b) => (a.ts||0) - (b.ts||0)).map(e => ({
      role: e.event === 'student_ask' ? 'me' : 'teacher',
      text: e.payload.text || '',
      ts: e.ts,
    }));
    // 新老师消息提醒：老师消息数变多了，且不是自己刚发的
    const teacherCount = msgs.filter(m => m.role === 'teacher').length;
    const hadTeacher = chatMsgs.some(m => m.role === 'teacher');
    if (teacherCount > chatSeenCount) {
      const title = $('chatTitle');
      if (title && hadTeacher) {
        title.textContent = '💬 和老师聊 — 🔔 老师回复了你！';
        setTimeout(() => { title.textContent = '（有问题直接说，老师回复会出现在这里）'; }, 5000);
      }
    }
    chatSeenCount = teacherCount;
    chatMsgs = msgs;
    renderChat();
  } catch(e){}
}
function sendAsk(){
  const text = $('askInput').value.trim();
  if (!text) { $('askHint').textContent = '⚠️ 先写点什么再发送'; return; }
  const sid = mySid();
  if (!sid) { $('askHint').textContent = '⚠️ 先在上方签到，才能和老师聊'; return; }
  Track.event('student_ask', { text: text, course, ts: Date.now() });
  $('askInput').value = '';
  $('askHint').textContent = '✅ 已发给老师，老师回复会出现在上面';
  setTimeout(() => { $('askHint').textContent = ''; }, 4000);
  refreshChat();
}
$('btnAsk').addEventListener('click', sendAsk);
$('askInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendAsk(); });
setInterval(refreshChat, 4000);   // 轮询老师回复

/* ---------- 我的学习水位（6 大知识点：水满 = 学得好；点击柱子看分析） ---------- */
/* 分析由 water-analyzer.py 常驻服务生成，学生端从 /api/water 读取 */
window.showWaterDetail = function(key){
  const body = $('mirrorBody');
  const items = body._water || [];
  const item = items.find(i => i.key === key);
  if (!item) return;
  const levelLabel = item.level === 'high' ? '不错' : item.level === 'mid' ? '练到一半' : '还要练';
  const overlay = document.createElement('div');
  overlay.className = 'wmodal';
  overlay.innerHTML = `
    <div class="wmodal-box">
      <div class="wmodal-head"><span>${item.icon} ${item.name}</span><span class="wmodal-close" onclick="this.closest('.wmodal').remove()">✕</span></div>
      <div class="wmodal-pct">当前水位：${item.pct}% <span class="wmodal-level ${item.level}">${levelLabel}</span></div>
      <div class="wmodal-body">${item.text || ''}</div>
      <div class="wmodal-tip">分析由系统根据你在这节课的行为自动生成（AI 深度分析接入后会更有针对性）。</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

async function renderMirror(){
  const sid = (localStorage.getItem('ar_class_monitor_sid') || '').trim();
  const body = $('mirrorBody');
  if (!sid) {
    body.innerHTML = '<div class="mirror-empty">🪪 先在上方签到，你的学习水位就会在这里亮起来。</div>';
    return;
  }
  $('mirrorCourse').textContent = '（6 块知识，水满了就说明这块学会了；点击柱子看详细分析）';

  // 从分析服务读取该生的六知识点水位
  let data = null;
  try {
    const r = await fetch('/api/water', { cache: 'no-store' });
    if (r.ok) data = await r.json();
  } catch(e){}
  const me = (data && data.students) ? data.students[sid] : null;
  if (!me || !me.items || !me.items.length) {
    body.innerHTML = '<div class="mirror-empty">📝 你还没有留下记录——去顷悟 APP 开工吧，<br><span class="dim">你每做一步，这里的水位就会涨一点。</span></div>';
    return;
  }
  body._water = me.items;   // 供弹窗分析用

  const rows = me.items.map(it => {
    return `<div class="wcell" onclick="showWaterDetail('${it.key}')" title="点击查看分析">
      <div class="wmeter ${it.level}"><div class="wfill" style="height:${it.pct}%"></div></div>
      <div class="wtip">${it.tip}</div>
      <div class="wn">${it.icon} ${it.name}</div>
      <div class="wp">${it.pct}%</div>
    </div>`;
  }).join('');

  // 底部解释：哪些学得好、哪些还要练
  const good = me.items.filter(it => it.pct >= 75).map(it => it.name);
  const need = me.items.filter(it => it.pct < 40).map(it => it.name);
  const summary = [];
  if (good.length) summary.push(`<b>学得不错：</b>${good.join('、')}`);
  if (need.length) summary.push(`<b>还要练：</b>${need.join('、')}`);
  if (!good.length && !need.length) summary.push('<b>还在起步</b>——多动手，水位就会涨');

  body.innerHTML = `
    <div class="wgrid">${rows}</div>
    <div class="wsummary">${summary.join('<br>')}</div>
    <div class="mirror-note dim">水位是系统根据你在这节课的行为自动分析的，参考用；老师那边看到的是同一份数据。点击任一柱子可看详细分析。</div>`;
}

/* ---------- 退出签到（只清本机身份，不清服务器课堂数据） ---------- */
function bindReset(){
  const btn = $('btnReset');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!confirm('退出签到？这台设备将不再以当前上课号上报，需要重新输号签到。')) return;
    try { localStorage.removeItem('ar_class_monitor_sid'); } catch(e){}
    try { localStorage.removeItem('ar_class_monitor_sid_info'); } catch(e){}
    try { localStorage.removeItem('ar_class_monitor_events'); } catch(e){}
    location.reload();
  });
}

/* ---------- 启动 ---------- */
(function init(){
  bindReset();
  bindSid();
  // 支持 ?course=1 直达某课
  try {
    const m = /[?&]course=([^&]+)/.exec(location.search);
    if (m && COURSES[m[1]]) { course = m[1]; Track.config({ course }); }
  } catch(e){}
  renderCourse();
  loadTask();
  renderMirror();
  setInterval(() => { loadTask(); renderMirror(); }, 4000);
  window.addEventListener('storage', loadTask);
  Track.event('page_loaded', { page: 'student-workbench', course });
})();
