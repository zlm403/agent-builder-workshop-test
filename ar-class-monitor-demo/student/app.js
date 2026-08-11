/* ============ 课堂工作台 · 学生端（通用壳） ============
   职责:
   1. 课程切换（预备课 / 第一课 / 第二课 / 综合课）
   2. 任务看板：接收老师按课推送的任务
   3. 本课引导：提示去顷悟 APP 对话 + 回到这里跑作品
   4. 作品运行容器：iframe 加载本课作品（P3 填充），使用数据自动上报
   与 AI 的对话在顷悟 APP 内完成（每课一个顷悟应用），本页不嵌对话通道。
   埋点: lib/track.js（POST /api/collect + localStorage 双写） */

const $ = id => document.getElementById(id);

/* ---------- 课程配置 ---------- */
const COURSES = {
  pre: {
    name: '预备课', icon: '🗨',
    app: '轻量级表达任务',
    goal: '从模糊想法到清晰表达',
    guide: [
      '打开顷悟 APP，进入「预备课·表达任务」应用',
      '在对话框里说出你的初步想法——不用想清楚，说砸了正好',
      '让 AI 帮你梳理成「对象 / 目标 / 问题」，你逐条确认、补充、修正',
      '回到这里：你的表达卡片会自动同步到老师端'
    ],
    work: null // P3: 如需作品容器填 URL
  },
  '1': {
    name: '第一课', icon: '🎮',
    app: '课程资料答疑和复习助手',
    goal: '从会回答到有依据地回答',
    guide: [
      '打开顷悟 APP，进入「第一课·答疑复习助手」应用',
      '把课程资料交给 AI，限定它的知识范围、设置回答依据',
      '测试它：问资料内的问题（应准确回答）和资料外的问题（应拒绝或说明）',
      '回到这里，把整理好的资料与问答记录做成你的小游戏，跑起来自动上报'
    ],
    work: '../game/index.html'
  },
  '2': {
    name: '第二课', icon: '🛠',
    app: '校园活动方案生成器',
    goal: '从回答问题到完成服务',
    guide: [
      '打开顷悟 APP，进入「第二课·活动方案生成器」应用',
      '告诉它活动目标、人数、场地、预算——它收集输入、检查信息、拆解步骤',
      '试试异常情况：信息不全时它会不会追问？乱输入时它会不会规范输出？',
      '回到这里，把生成器做成一个网页工具，跑起来自动上报'
    ],
    work: '../tool/index.html'
  },
  '4': {
    name: '综合课', icon: '🤖',
    app: '多员工 AI 应用',
    goal: '从单个员工到能力系统',
    guide: [
      '打开顷悟 APP，进入「综合课·多员工应用」',
      '把一个大目标拆成多个能力，分配给不同 AI 员工，各自选好工具',
      '设计员工之间的交接：谁做完交给谁，接口是什么',
      '测试并发布：整个系统跑通后，使用数据自动上报到老师端'
    ],
    work: null // P3: 如需要
  }
};
let course = 'pre';

/* ---------- 初始化埋点 ---------- */
Track.config({ endpoint: '/api/collect', course: course, page: 'student-workbench' });

/* ---------- 学号 ---------- */
function bindSid(){
  const sid = localStorage.getItem('ar_class_monitor_sid') || '';
  $('sid').value = sid;
  if (sid) Track.config({ sid });
}
$('sid').addEventListener('change', () => {
  const v = $('sid').value.trim();
  localStorage.setItem('ar_class_monitor_sid', v);
  Track.config({ sid: v || undefined });
  Track.event('sid_set', { sid: v });
});

/* ---------- 课程切换 ---------- */
function renderCourse(){
  const c = COURSES[course];
  document.querySelectorAll('.course').forEach(el => el.classList.toggle('on', el.dataset.course === course));
  $('guideCourse').textContent = '—— ' + c.icon + ' ' + c.name + '（' + c.app + '）';
  $('guideList').innerHTML = c.guide.map((g, i) =>
    `<li><b>${i+1}.</b> ${g.replace(/</g,'&lt;')}</li>`
  ).join('');
  // 作品容器
  const box = $('workBox');
  const empty = $('workEmpty');
  if (c.work) {
    empty.hidden = true;
    box.innerHTML = '<iframe src="' + c.work + '" class="workframe" title="作品运行区"></iframe>';
  } else {
    empty.hidden = false;
    box.innerHTML = '';
  }
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

/* ---------- 我的理解棱镜（学生端自我显影） ---------- */
const MIRROR_TASK = { pre: 'pre', 1: 't1', 2: 't2', 3: 't3', 4: 't3' };
const MIRROR_NAME = { pre: '语言棱镜 · 想法说清楚没', t1: '边界棱镜 · 依据在不在资料内', t2: '规则棱镜 · 流程与规则立没立', t3: '系统棱镜 · 能力系统成没成' };

let mirrorTimer = null;
async function renderMirror(){
  const sid = (localStorage.getItem('ar_class_monitor_sid') || '').trim();
  const body = $('mirrorBody');
  const task = MIRROR_TASK[course] || null;
  $('mirrorCourse').textContent = task ? '—— ' + COURSES[course].icon + ' ' + COURSES[course].name + '（' + MIRROR_NAME[task] + '）' : '';
  if (!sid) {
    body.innerHTML = '<div class="mirror-empty">🪪 先在右上角填上学号/姓名，你的每一步就会在这里显影成理解棱镜。</div>';
    return;
  }
  if (!task) return;

  let evs = [];
  try {
    const r = await fetch('/api/events?since=0', { cache: 'no-store' });
    if (r.ok) evs = await r.json();
  } catch(e){}
  evs = evs.filter(e => e.sid === sid && Analyzer.taskIdOf(e.payload) === task);
  const traj = evs.map(e => ({ event: e.event, payload: e.payload }));

  if (!traj.length) {
    body.innerHTML = '<div class="mirror-empty">📝 你在这课还没有留下记录——去顷悟 APP 开工吧，<br><span class="dim">每做一步，这边的棱镜就会亮起一格。</span></div>';
    return;
  }

  const r = Analyzer.clarityFor(task, traj);
  const cellsHtml = r.grid.map(c => {
    const st = Analyzer.STATE[c.state];
    const isGap = Analyzer.detectGap([c]).length > 0;
    return `<div class="mcell ${isGap ? 'gap' : ''}">
      <div class="mn">${c.i}. ${c.name}</div>
      <div class="mv">${c.value ? c.value.replace(/</g,'&lt;') : '—'}</div>
      <div class="ms ${st.cls}">${st.sym} ${st.label}</div>
    </div>`;
  }).join('');

  // 预备课：回读句（“模型实际听到的”）
  let readback = '';
  if (task === 'pre') {
    readback = `<div class="mirror-readback">🧠 <b>AI 实际听到的：</b>\n${Analyzer.paraphrase(r.grid).replace(/</g,'&lt;')}</div>`;
  }

  // 缺口清单
  const gap = Analyzer.detectGap(r.grid);
  const gapHtml = gap.length
    ? `<div class="mirror-gap">🔧 你还没立住：${gap.map(c => `${c.name}（${Analyzer.STATE[c.state].label}）`).join('、')}。补上这些，这课才算立住。</div>`
    : '<div class="mirror-gap" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#86efac">✅ 这课的棱镜基本立住了，继续保持！</div>';

  body.innerHTML = `
    <div class="mirror-score">清晰度 ${r.score} / 100 · 缺口 ${r.gapCount} 个${r.clear ? ' · 已立住' : ''}</div>
    <div style="margin-top:10px" class="mirror-grid">${cellsHtml}</div>
    ${readback}
    ${gapHtml}`;
}

/* ---------- 启动 ---------- */
(function init(){
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
