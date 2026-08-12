/* ============ 老师监控看板（服务端数据版） ============
   数据源: GET /api/events?since= 增量轮询（主），localStorage 兼容（次）
   功能:
   1. 按项目筛选（全部/项目一·接金币游戏/项目二·心情电量/项目三·内心戏）
   2. 推送课堂任务（带课程标记，POST /api/collect + localStorage 槽）
3. 实时看每位学生的对话数据（顷悟 Agent）+ 作品数据（作品埋点）
    4. 选中学生 → 穿透分析: 原话 vs AI 结构化理解 + Agent 对话 + 作品轨迹 */

const API = '/api/events';
const COLLECT = '/api/collect';
const EVENT_KEY = 'ar_class_monitor_events';
const TASK_EVENT_KEY = 'ar_class_monitor_task';
const MAX_EVENTS = 8000;

const COURSE_NAME = { pre: '🗨 预备课', 1: '🎮 项目一·接金币游戏', 2: '🔋 项目二·心情电量', 4: '🤖 项目三·内心戏' };

let events = [];
let lastTs = 0;
let selectedSid = null;
let filter = 'all';
let courseFilter = 'all';

const $ = id => document.getElementById(id);
const fmt = ts => {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
};

/* ---------- 事件归类 ---------- */
function courseOf(e){ return e.course || (e.payload && e.payload.course) || ''; }
function matchCourse(e){ return (courseFilter === 'all') || (courseOf(e) === courseFilter); }

const TAGNAME = {
  task_push:['idea','📨 老师推送任务'],
  task_view:['done','✅ 学生收到任务'],
  tab_switch:['step','🔀 切标签页'],
  exec_mode:['step','🎛 切换执行模式'],
  course_switch:['step','🔀 切换课程'],
  sid_set:['chat','🪪 填写学号'],
  idea_submit:['idea','💬 提交想法'],
  ai_translate_click:['chat','🔁 点翻译'],
  ai_translate_done:['resp','🧠 翻译结果'],
  ai_chat_req:['chat','🤖 AI 请求'],
  ai_chat_resp:['resp','💬 AI 回复'],
  ai_chat_err:['chat','⚠️ AI 出错'],
  agent_dialog_req:['agent','🤖 Agent 对话(学员)'],
  agent_dialog_resp:['resp','💬 Agent 回复'],
  ai_ask_more:['chat','🤔 追问 AI'],
  fields_filled:['chat','✍️ 填字段'],
  step:['step','📍 进入步骤'],
  readback_confirm:['done','✅ 确认回读'],
  readback_reject:['step','↩ 回去修改'],
  finish:['done','🎉 完成'],
  penetration_analyze_click:['chat','🧠 点复盘'],
  penetration_analysis:['resp','📊 复盘结果'],
  login:['chat','🔑 登录'],
  page_loaded:['chat','🖥️ 进入页面/作品'],
  game_start:['work','🎮 游戏开始'],
  game_score:['work','🏆 得分'],
  game_over:['work','🏁 游戏结束'],
  tool_submit:['work','🛠 工具提交'],
  tool_result:['work','📄 工具结果'],
};
function tagOf(ev){
  const t = TAGNAME[ev.event];
  const cls = (ev.event === 'agent_dialog_req' || ev.event === 'agent_dialog_resp') ? 'agent'
    : (t ? t[0] : 'chat');
  return `<span class="tag ${cls}">${t ? t[1] : ev.event}</span>`;
}
function sourceOf(ev){
  if (ev.event.startsWith('agent_')) return 'agent';
  if (ev.event === 'task_push' || ev.event === 'task_view') return 'task';
  return 'web';
}
/* 作品数据 = 网页来源里属于"作品使用"的事件（区别于页面内操作） */
const WORK_EVENTS = ['page_loaded','game_start','game_score','game_over','tool_submit','tool_result'];
function isWorkEvent(ev){ return WORK_EVENTS.includes(ev.event); }
function courseTagOf(ev){
  const c = courseOf(ev);
  return c && COURSE_NAME[c] ? `<span class="ctag">${COURSE_NAME[c]}</span>` : '';
}

/* ---------- 数据加载（服务端增量 + 本地兼容） ---------- */
function loadLocal(){
  try { return JSON.parse(localStorage.getItem(EVENT_KEY) || '[]'); } catch(e){ return []; }
}
function mergeInto(fresh){
  const seen = new Set(events.map(e => [e.ts, e.sid, e.event, JSON.stringify(e.payload || {})].join('|')));
  let added = 0;
  fresh.forEach(e => {
    const k = [e.ts, e.sid, e.event, JSON.stringify(e.payload || {})].join('|');
    if (seen.has(k)) return;
    seen.add(k);
    events.push(e);
    added++;
  });
  events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  return added;
}
async function load(){
  let ok = false, errMsg = '';
  try {
    const r = await fetch(API + '?since=' + lastTs, { cache: 'no-store' });
    if (r.ok) {
      const fresh = await r.json();
      if (fresh.length) {
        mergeInto(fresh);
        lastTs = Math.max(lastTs, ...fresh.map(e => e.ts || 0));
      }
      ok = true;
    } else {
      errMsg = 'HTTP ' + r.status;
    }
  } catch(e){ errMsg = String(e && e.message ? e.message : e); }
  mergeInto(loadLocal());   // 兼容老师本机 localStorage 事件
  renderAll();
  renderConnChip(ok, errMsg);
}
function renderConnChip(ok, err){
  const chip = document.getElementById('connChip');
  if (!chip) return;
  if (ok) {
    if (err) return;
    chip.textContent = '✅ 已连接 · ' + events.length + ' 条事件';
    chip.style.color = 'var(--green)';
    chip.style.borderColor = 'rgba(34,197,94,.45)';
  } else {
    chip.textContent = '⚠️ 连接失败：' + err + '（服务器没在跑？）';
    chip.style.color = 'var(--orange)';
    chip.style.borderColor = 'rgba(251,146,60,.6)';
  }
  chip.style.display = '';
}
function renderAll(){ renderClassPrism(); renderStudents(); renderTimeline(); renderXray(); renderConvList(); renderTeacherChat(); }
/* ---------- 班级理解棱镜（一核多表：每课各穿各自的维度表） ---------- */
function taskOfCourse(c){
  if (c === 'pre') return 'pre';
  if (c === '1') return 't1';
  if (c === '2') return 't2';
  if (c === '4') return 't3';
  return null;
}
const STATE_ORDER = ['ok', 'rec', 'guess', 'clarify', 'empty', 'conflict'];
/* ---------- 班级学情（六大知识点：全班平均水位柱状图，点柱子看明细） ---------- */
let classWater = { updated: 0, students: {} };
async function loadClassWater(){
  try {
    const r = await fetch('/api/water', { cache: 'no-store' });
    if (r.ok) classWater = await r.json();
    renderClassPrism();
  } catch(e){}
}
function renderClassPrism(){
  const grid = $('prismGrid');
  if (!grid) return;
  const students = classWater.students || {};
  const sids = Object.keys(students);
  if (!sids.length) {
    grid.innerHTML = '<div class="empty">还没有学习数据——学生开工后这里显示全班掌握情况</div>';
    $('prismInfo').textContent = '（六大知识点全班掌握情况，点柱子看明细）';
    return;
  }
  // 聚合：每个知识点的全班平均水位 + 达标(≥60)人数
  const items = students[sids[0]].items || [];
  const agg = items.map(it => {
    const vals = sids.map(s => {
      const item = (students[s].items || []).find(x => x.key === it.key);
      return item ? item.pct : 0;
    });
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const pass = vals.filter(v => v >= 60).length;
    return { key: it.key, name: it.name, icon: it.icon, avg, pass, n: vals.length };
  });
  $('prismInfo').textContent = '全班 ' + sids.length + ' 人 · 六大知识点掌握情况（点击柱子看明细）';
  grid.innerHTML = agg.map(a => {
    const level = a.avg >= 60 ? 'hi' : a.avg >= 35 ? 'mid' : 'lo';
    return `<div class="prism-cell ${level}" onclick="showClassDetail('${a.key}')" title="点击查看该知识点全班明细">
      <div class="pn">${a.icon} ${a.name}</div>
      <div class="bar-wrap"><div class="bar ${level}" style="height:${Math.max(8, a.avg)}%"></div></div>
      <div class="pv">${a.avg}%</div>
      <div class="ps">${a.pass}/${a.n} 人达标</div>
    </div>`;
  }).join('');
}
window.showClassDetail = function(key){
  const students = classWater.students || {};
  const sids = Object.keys(students);
  if (!sids.length) return;
  const item0 = (students[sids[0]].items || []).find(x => x.key === key);
  if (!item0) return;
  const rows = sids.map(s => {
    const item = (students[s].items || []).find(x => x.key === key);
    const pct = item ? item.pct : 0;
    const level = pct >= 60 ? 'hi' : pct >= 35 ? 'mid' : 'lo';
    return `<div class="xrow ${level === 'hi' ? 'ok' : level === 'lo' ? 'bad' : ''}"><span class="xk">学生 ${s}</span><span class="xv">${pct}%</span></div>`;
  }).sort((a, b) => {
    const pa = parseInt(a.match(/(\d+)%/)[1]), pb = parseInt(b.match(/(\d+)%/)[1]);
    return pb - pa;
  }).join('');
  const overlay = document.createElement('div');
  overlay.className = 'wmodal';
  overlay.innerHTML = `
    <div class="wmodal-box">
      <div class="wmodal-head"><span>${item0.icon} ${item0.name} · 全班明细</span><span class="wmodal-close" onclick="this.closest('.wmodal').remove()">✕</span></div>
      <div class="wmodal-body">${rows || '（暂无学生数据）'}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

/* ---------- 课堂任务框架（课程 = 一节课，含 N 个任务，逐个推送+锁定） ---------- */
let lessonTasks = [];   // 当前课程的拆解任务 [{no,title,steps,points,pushed,unlocked}]
let lessonName = '';    // 当前课程名

async function loadLesson(){
  try {
    const r = await fetch('/api/lesson', { cache: 'no-store' });
    const d = await r.json();
    const cur = d.currentLesson;
    if (cur && d.lessons && d.lessons[cur]) {
      lessonName = cur;
      lessonTasks = d.lessons[cur].tasks || [];
    }
    renderUnlock(d.projectUnlock || {});
    renderLessonTasks();
  } catch(e){}
}
function renderUnlock(unlock){
  const labels = { '1': '🎮 项目一', '2': '🔋 项目二', '4': '🤖 项目三' };
  Object.keys(labels).forEach(k => {
    const btn = $('up' + k);
    if (!btn) return;
    const on = !!unlock[k];
    btn.textContent = (on ? '🔓 已解锁 · ' : '🔒 已锁定 · ') + labels[k];
    btn.classList.toggle('unlock-on', on);
    btn.classList.toggle('unlock-off', !on);
  });
}
window.unlockProject = async function(k){
  const d = await (await fetch('/api/lesson', { cache: 'no-store' })).json();
  const unlock = d.projectUnlock || { '1': true, '2': false, '4': false };
  unlock[k] = !unlock[k];
  await fetch('/api/lesson/unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectUnlock: unlock }),
  }).catch(() => {});
  renderUnlock(unlock);
};
function renderLessonTasks(){
  const box = $('lessonTasks');
  if (!box) return;
  if (!lessonTasks.length) {
    box.innerHTML = '<div class="lesson-empty">还没有任务——粘贴课程内容，点「AI 拆解任务」生成</div>';
    return;
  }
  box.innerHTML = lessonTasks.map((t, i) => `
    <div class="ltask">
      <div class="ltask-head">
        <span class="ltask-no">${t.no}</span>
        <span class="ltask-title">${esc(t.title)}</span>
        ${t.pushed
          ? '<span class="ltask-state pushed">✅ 已推送</span>'
          : '<button class="ghost ghost-mini" onclick="pushTask(' + i + ')">推送</button>'}
        <button class="ghost ghost-mini" onclick="editTask(' + i + ')">✏️改</button>
      </div>
      ${t.steps ? `<div class="ltask-body"><b>步骤：</b>${esc(t.steps).replace(/\n/g,'<br>')}</div>` : ''}
      ${t.points ? `<div class="ltask-body"><b>注意：</b>${esc(t.points).replace(/\n/g,'<br>')}</div>` : ''}
    </div>`).join('');
}
window.pushTask = function(i){
  const t = lessonTasks[i];
  if (!t) return;
  // 推送：该任务解锁（学生端可见），其他保持锁定
  lessonTasks.forEach((tt, idx) => { tt.unlocked = (idx === i); });
  t.pushed = true;
  // 广播 task_push 事件（含解锁状态）
  const rec = {
    ts: Date.now(), sid: 'teacher', course: '', event: 'task_push',
    payload: { _ts: Date.now(), course: '', task_no: t.no, title: t.title, steps: t.steps, points: t.points, unlocked: true }
  };
  try { localStorage.setItem(TASK_EVENT_KEY, JSON.stringify(rec)); } catch(e){}
  try {
    const arr = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
    arr.push(rec); localStorage.setItem(EVENT_KEY, JSON.stringify(arr));
  } catch(e){}
  fetch(COLLECT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }).catch(() => {});
  saveLesson();
  renderLessonTasks();
};
window.editTask = function(i){
  const t = lessonTasks[i];
  if (!t) return;
  const html = `
    <div class="wmodal">
      <div class="wmodal-box editbox">
        <div class="wmodal-head"><span>编辑 ${t.no}</span><span class="wmodal-close" onclick="this.closest('.wmodal').remove()">✕</span></div>
        <div class="edit-field"><label>任务标题</label><input id="eTitle" value="${esc(t.title)}"></div>
        <div class="edit-field"><label>步骤（每行一条）</label><textarea id="eSteps" rows="4">${esc(t.steps)}</textarea></div>
        <div class="edit-field"><label>知识点/注意点（每行一条）</label><textarea id="ePoints" rows="3">${esc(t.points)}</textarea></div>
        <div class="row"><button class="primary" onclick="saveEdit(${i})">✓ 确定</button></div>
      </div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
};
window.saveEdit = function(i){
  const t = lessonTasks[i];
  const title = document.getElementById('eTitle').value.trim();
  const steps = document.getElementById('eSteps').value.trim();
  const points = document.getElementById('ePoints').value.trim();
  if (!title) return;
  t.title = title; t.steps = steps; t.points = points;
  document.querySelector('.wmodal') && document.querySelector('.wmodal').remove();
  saveLesson();
  renderLessonTasks();
};
function saveLesson(){
  fetch('/api/lesson/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: lessonName || ('课' + Date.now()), tasks: lessonTasks }),
  }).catch(() => {});
}
$('btnSplit').addEventListener('click', async () => {
  const text = $('lessonText').value.trim();
  if (!text) { $('splitHint').textContent = '⚠️ 先粘贴课程内容'; return; }
  $('splitHint').textContent = '⏳ AI 拆解中…';
  try {
    const r = await fetch('/api/split-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const res = await r.json();
    if (res.ok) {
      lessonName = '课' + Date.now();
      lessonTasks = res.tasks;
      saveLesson();
      renderLessonTasks();
      $('splitHint').textContent = '✅ 已拆成 ' + lessonTasks.length + ' 个任务，可点 ✏️改 调整，逐个「推送」';
    } else {
      $('splitHint').textContent = '⚠️ ' + (res.reason || '拆解失败');
    }
  } catch(e) {
    $('splitHint').textContent = '⚠️ 拆解失败：' + e;
  }
});
loadLesson();
setInterval(loadLesson, 5000);

/* ---------- 大屏内容控制台 ---------- */
let screenActive = null;
let screenBlocks = [];
async function loadScreenBlocks(){
  try {
    // 1) 每个已推送的课堂任务 → 一个可投内容块（id 固定，不重复）
    try {
      const lr = await fetch('/api/lesson', { cache: 'no-store' });
      const ld = await lr.json();
      const cur = ld.currentLesson;
      const tasks = (cur && ld.lessons && ld.lessons[cur]) ? (ld.lessons[cur].tasks || []) : [];
      tasks.filter(t => t.pushed).forEach(t => {
        fetch('/api/screen/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'blk_task_' + (t.no || '').replace(/[^\w\u4e00-\u9fa5]/g, ''),
            type: 'task',
            title: t.no + ' · ' + t.title,
            content: { title: t.title, steps: t.steps, points: t.points },
            source: 'auto',
          }),
        });
      });
    } catch(e){}
    // 2) 读全部块（含课堂任务块）
    const r = await fetch('/api/screen', { cache: 'no-store' });
    const d = await r.json();
    screenBlocks = d.blocks || [];
    screenActive = d.activeId;
    renderScreenBlocks();
  } catch(e){}
}
function renderScreenBlocks(){
  const box = $('screenBlocks');
  if (!box) return;
  if (!screenBlocks.length) {
    box.innerHTML = '<div class="lesson-empty">还没有内容块——添加一个（文字/图片/视频/网页），点它投到大屏</div>';
    return;
  }
  const icons = { task: '📋', text: '📝', image: '🖼', video: '🎬', page: '🌐' };
  const isTask = id => (id || '').indexOf('blk_task_') === 0;
  // 课堂任务块排最前，其余按时间
  const sorted = [...screenBlocks].sort((a, b) => {
    const at = isTask(a.id), bt = isTask(b.id);
    if (at && !bt) return -1;
    if (!at && bt) return 1;
    return (a.ts || 0) - (b.ts || 0);
  });
  box.innerHTML = sorted.map(b => {
    const on = b.id === screenActive;
    const src = b.source === 'external' ? ' · 外部' : (b.source === 'auto' ? ' · 自动' : '');
    const del = isTask(b.id) ? '' : `<span class="sblk-del" onclick="event.stopPropagation();delScreenBlock('${b.id}')">✕</span>`;
    return `<div class="sblk ${on ? 'on' : ''}" onclick="setScreenActive('${b.id}')" title="点击投到大屏">
      <span class="sblk-icon">${icons[b.type] || '📄'}</span>
      <span class="sblk-title">${esc(b.title)}${src}</span>
      <span class="sblk-state">${on ? '● 投屏中' : '点击投放'}</span>
      ${del}
    </div>`;
  }).join('');
}
window.setScreenActive = async function(id){
  await fetch('/api/screen/active', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {});
  loadScreenBlocks();
};
window.delScreenBlock = async function(id){
  if (!confirm('删除这个内容块？')) return;
  await fetch('/api/screen/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {});
  loadScreenBlocks();
};
$('btnAddBlock').addEventListener('click', async () => {
  const type = $('blkType').value;
  const title = $('blkTitle').value.trim();
  const content = $('blkContent').value.trim();
  if (!title) { alert('先填内容标题'); return; }
  if (type !== 'text' && !content) { alert('图片/视频/网页需要填链接'); return; }
  await fetch('/api/screen/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title, content, source: 'teacher' }),
  }).catch(() => {});
  $('blkTitle').value = '';
  $('blkContent').value = '';
  loadScreenBlocks();
});
$('btnUploadBlock').addEventListener('click', () => {
  const file = $('blkFile').files[0];
  if (!file) { $('uploadHint').textContent = '⚠️ 先选一个文件'; return; }
  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');
  if (!isImg && !isVid) { $('uploadHint').textContent = '⚠️ 只支持图片或视频'; return; }
  const reader = new FileReader();
  reader.onload = async () => {
    const b64 = String(reader.result).split(',')[1];
    $('uploadHint').textContent = '⏳ 上传中…';
    try {
      const r = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: b64 }),
      });
      const res = await r.json();
      if (res.ok) {
        const title = file.name.replace(/\.[^.]+$/, '');
        await fetch('/api/screen/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: isImg ? 'image' : 'video', title, content: res.url, source: 'teacher' }),
        });
        $('uploadHint').textContent = '✅ 已上传并投屏，大屏正在显示';
        $('blkFile').value = '';
        loadScreenBlocks();
      } else {
        $('uploadHint').textContent = '⚠️ 上传失败：' + (res.reason || '');
      }
    } catch(e) {
      $('uploadHint').textContent = '⚠️ 上传失败：' + e;
    }
  };
  reader.readAsDataURL(file);
});
loadScreenBlocks();
setInterval(loadScreenBlocks, 4000);

/* ---------- 课程筛选 ---------- */
document.querySelectorAll('.cbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    courseFilter = btn.dataset.course;
    $('pushCourseTag').textContent = '（推送给' + (courseFilter === 'all' ? '全部课程' : COURSE_NAME[courseFilter]) + '）';
    renderAll();
  });
});

/* ---------- 学生列表（含清晰度分数环 + 缺口数） ---------- */
function renderStudents(){
  const map = {};
  const matched = events.filter(matchCourse);
  matched.forEach(e => {
    if (e.sid === 'teacher') return;
    if (!map[e.sid]) map[e.sid] = { count:0, agent:0, work:0, done:false, last:0, taskView:false, lastTask:null };
    map[e.sid].count++;
    map[e.sid].last = e.ts;
    const t = taskIdOf(e.payload);
    if (t) map[e.sid].lastTask = t;
    if (sourceOf(e) === 'agent') map[e.sid].agent++;
    if (isWorkEvent(e)) map[e.sid].work++;
    if (e.event === 'finish') map[e.sid].done = true;
    if (e.event === 'task_view') map[e.sid].taskView = true;
  });
  const sids = Object.keys(map).sort((a, b) => map[b].last - map[a].last);
  if (!sids.length) { $('studentList').innerHTML = '<div class="empty">等待学生进入…</div>'; return; }
  const task = taskOfCourse(courseFilter);   // all 时用学生最近课
  $('studentList').innerHTML = sids.map(s => {
    const m = map[s];
    const ago = Math.round((Date.now() - m.last) / 1000);
    // 清晰度（当前筛选课；all 时用该生最近有数据的课）
    let score = null, gap = 0;
    const t = task || m.lastTask;
    if (t) {
      const traj = matched.filter(e => e.sid === s && taskIdOf(e.payload) === t).map(e => ({ event: e.event, payload: e.payload }));
      const r = Analyzer.clarityFor(t, traj);
      score = r.score; gap = r.gapCount;
    }
    const ringCls = score === null ? '' : score >= 60 ? 'hi' : score >= 35 ? 'mid' : 'lo';
    const ringHtml = score === null
      ? ''
      : `<div class="ringwrap"><div class="ring ${ringCls}" style="background:conic-gradient(currentColor ${score * 3.6}deg,#13203f 0)">${score}</div><span class="gaps">缺${gap}</span></div>`;
    return `<div class="stu ${s === selectedSid ? 'on' : ''}" onclick="selectSid('${s.replace(/'/g, "\\'")}')">
      <div>
        <span class="nm">${s}</span>
        <span class="ct">${m.count} 事件${m.agent ? ' · 🤖' + m.agent : ''}${m.work ? ' · 🎮' + m.work : ''} · ${ago}s 前</span>${m.done ? '<span class="ok">✓完成</span>' : ''}
      </div>
      ${ringHtml}
    </div>`;
  }).join('');
}
window.selectSid = function(s){
  selectedSid = (selectedSid === s) ? null : s;
  openConv(s);   // 点学生列表同时打开该生会话
  renderAll();
};

/* ---------- 消息中心（学生提问实时进来，点消息回复即定向） ---------- */
/* ---------- 消息中心（会话列表 + 聊天窗口，像微信单聊） ---------- */
let activeConvSid = null;   // 当前打开的会话（学生上课号）
let convRead = {};          // 每个会话已读的学生消息数（用于新消息标红）

function allConvMsgs(){
  return events
    .filter(e => e.event === 'student_ask' || e.event === 'teacher_reply')
    .sort((a,b) => (a.ts||0) - (b.ts||0));
}
function convOfSid(sid, msgs){
  return (msgs || allConvMsgs()).filter(e => e.sid === sid);
}
function renderConvList(){
  const list = $('convList');
  const msgs = allConvMsgs();
  if (!list) return;
  if (!msgs.length) { list.innerHTML = '<div class="conv-empty">暂无学生消息</div>'; return; }
  // 按学生分组，最近消息的排最上
  const bySid = {};
  msgs.forEach(e => (bySid[e.sid] = bySid[e.sid] || []).push(e));
  const sids = Object.keys(bySid).sort((a,b) => (bySid[b][bySid[b].length-1].ts||0) - (bySid[a][bySid[a].length-1].ts||0));
  list.innerHTML = sids.map(sid => {
    const ms = bySid[sid];
    const last = ms[ms.length-1];
    const askCount = ms.filter(e => e.event === 'student_ask').length;
    const read = convRead[sid] || 0;
    const unread = askCount > read ? askCount - read : 0;
    const lastText = (last.payload.text || '').slice(0, 18);
    return `<div class="conv-item ${sid === activeConvSid ? 'on' : ''}" onclick="openConv('${sid}')">
      <div class="conv-name">学生 ${sid}${unread ? '<span class="conv-unread">' + unread + '</span>' : ''}</div>
      <div class="conv-preview">${esc(lastText)}</div>
      <div class="conv-time">${fmt(last.ts)}</div>
    </div>`;
  }).join('');
}
window.openConv = function(sid){
  activeConvSid = sid;
  const msgs = convOfSid(sid);
  convRead[sid] = msgs.filter(e => e.event === 'student_ask').length;   // 标记已读
  const head = $('convHead');
  const input = $('tAskInput');
  const btn = $('btnTAsk');
  if (head) head.textContent = '💬 学生 ' + sid;
  if (input) { input.disabled = false; input.focus(); }
  if (btn) btn.disabled = false;
  renderConvList();
  renderTeacherChat();
};
function renderTeacherChat(){
  const log = $('tchatLog');
  if (!log) return;
  if (!activeConvSid) {
    log.innerHTML = '<div class="chat-empty">点左侧学生，查看并回复 TA 的消息</div>';
    return;
  }
  const msgs = convOfSid(activeConvSid);
  if (!msgs.length) {
    log.innerHTML = '<div class="chat-empty">TA 还没有消息</div>';
    return;
  }
  // 时间正序：新消息沉底
  log.innerHTML = msgs.map(e => {
    const isAsk = e.event === 'student_ask';
    return `<div class="chat-msg ${isAsk ? 'stu' : 'teacher'}"><div class="bubble"><div class="chat-who">${isAsk ? '学生' : '我'}</div>${esc(e.payload.text || '')}</div></div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
}
function sendTeacherReply(){
  const text = $('tAskInput').value.trim();
  if (!text || !activeConvSid) return;
  fetch('/api/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sid: activeConvSid, event: 'teacher_reply', payload: { text: text } }),
  }).catch(() => {});
  $('tAskInput').value = '';
  renderTeacherChat();
}
$('btnTAsk').addEventListener('click', sendTeacherReply);
$('tAskInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendTeacherReply(); });

/* ---------- 时间线（课程 + 来源筛选） ---------- */
function renderTimeline(){
  let list = events.filter(matchCourse);
  if (selectedSid) list = list.filter(e => e.sid === selectedSid);
  if (filter !== 'all') list = list.filter(e => sourceOf(e) === filter);
  const show = list.slice(-150).reverse();
  const cName = (courseFilter === 'all') ? '全部课程' : COURSE_NAME[courseFilter];
  const fName = (filter === 'all') ? '全部来源' : { web: '🖥 作品/网页', agent: '🤖 Agent', task: '📨 任务' }[filter];
  $('tlInfo').textContent = (selectedSid ? '只看：' + selectedSid + ' · ' : '') + cName + ' · ' + fName;
  if (!show.length) { $('timeline').innerHTML = '<div class="empty">暂无事件</div>'; return; }
  $('timeline').innerHTML = show.map(e => {
    const p = Object.keys(e.payload || {}).length
      ? Object.entries(e.payload).map(([k, v]) => {
          if (k === '_ts') return '';
          return `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
        }).filter(Boolean).join('\n')
      : '';
    return `<div class="ev"><div class="tm">${fmt(e.ts)}</div><div class="bd">
      <span class="nm">${e.sid}</span>${courseTagOf(e)}${tagOf(e)}
      ${p ? `<div class="payload">${p.replace(/</g, '&lt;')}</div>` : ''}
    </div></div>`;
  }).join('');
}

/* ---------- 穿透分析（选中学生） ---------- */
function renderXray(){
  const panel = $('xrayPanel');
  if (!selectedSid) { panel.hidden = true; return; }
  const evs = events.filter(e => e.sid === selectedSid && matchCourse(e));
  const ideaEv = evs.filter(e => e.event === 'idea_submit').pop();
  const transEv = evs.filter(e => e.event === 'ai_translate_done').pop();
  const fieldsEv = evs.filter(e => e.event === 'fields_filled').pop();
  const agentReqs = evs.filter(e => e.event === 'agent_dialog_req');
  const agentResps = evs.filter(e => e.event === 'agent_dialog_resp');
  const workEvs = evs.filter(isWorkEvent).slice(-20);

  $('xraySid').textContent = '—— ' + selectedSid;
  $('xIdea').textContent = ideaEv ? ideaEv.payload.idea : '（暂无）';
  $('xIdea').className = 'xc-body' + (ideaEv ? '' : ' dim');

  const FIELDS = ['对象', '问题', '目标', '限制', '场景', '标准'];
  const understood = {};
  FIELDS.forEach(f => understood[f] = '');
  if (transEv) {
    FIELDS.forEach(f => {
      const m = transEv.payload.reply.match(new RegExp(f + '[:：]\\s*([^\\n]+)'));
      if (m && m[1]) understood[f] = m[1].trim();
    });
  }
  if (fieldsEv) Object.assign(understood, fieldsEv.payload.values || {});
  const rows = FIELDS.map(f => {
    const v = understood[f] && understood[f] !== '？' ? understood[f] : '';
    return `<div class="xrow ${v ? 'ok' : 'bad'}"><span class="xk">${f}</span><span class="xv">${v || '空'}</span></div>`;
  }).join('');
  $('xFields').innerHTML = rows || '（暂无）';
  $('xFields').className = 'xc-body';

  if (agentReqs.length) {
    const rowsA = [];
    agentReqs.forEach((r, i) => {
      rowsA.push(`<div class="xmsg"><b>学员</b>${(r.payload.text || '').replace(/</g, '&lt;')}</div>`);
      const resp = agentResps[i];
      if (resp) rowsA.push(`<div class="xmsg ai"><b>Agent</b>${(resp.payload.reply || '').replace(/</g, '&lt;')}</div>`);
    });
    $('xAgent').innerHTML = rowsA.join('');
    $('xAgent').className = 'xc-body';
  } else {
    $('xAgent').textContent = '（暂无）';
    $('xAgent').className = 'xc-body dim';
  }

  if (workEvs.length) {
    $('xWork').innerHTML = workEvs.map(e => {
      const p = Object.keys(e.payload || {}).length
        ? Object.entries(e.payload).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')
        : '';
      return `<div class="xmsg ${isWorkEvent(e) ? 'work' : ''}"><b>${fmt(e.ts)}</b>${tagOf(e)}${p ? '<br><span class="dim">' + p.replace(/</g, '&lt;') + '</span>' : ''}</div>`;
    }).join('');
    $('xWork').className = 'xc-body';
  } else {
    $('xWork').textContent = '（暂无作品数据）';
    $('xWork').className = 'xc-body dim';
  }
  panel.hidden = false;
}

/* ---------- 来源筛选 ---------- */
document.querySelectorAll('.fbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    filter = btn.dataset.filter;
    renderTimeline();
  });
});

/* ---------- 大屏 / 学生屏：标题旁 <a target="_blank"> 胶囊链接，无需 JS 绑定 ---------- */

/* ---------- 课堂场次与签到 ---------- */
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function loadSessions(){
  try {
    const r = await fetch('/api/session', { cache: 'no-store' });
    const d = await r.json();
    renderSessions(d);
  } catch(e) {}
}
function renderSessions(d){
  const list = $('sessionList');
  if (!list) return;
  const sessions = d.sessions || [];
  const activeId = d.activeSessionId;
  $('sessionInfo').textContent = sessions.length
    ? '当前场次：' + esc(activeName(sessions, activeId)) + ' —— 学生凭号签到，签到后数据自动归到该号名下'
    : '（课前录入本场上课号，学生拿号签到，签到成功后数据自动归到该号名下）';
  if (!sessions.length) { list.innerHTML = ''; return; }
  list.innerHTML = sessions.map(s => {
    const usedCount = Object.keys(s.used || {}).length;
    const total = (s.numbers || []).length;
    const chips = (s.numbers || []).map(n => {
      const used = s.used && s.used[n];
      return `<span class="chip-mini ${used ? 'ok' : ''}" title="${used ? '已签到' : '未签到'}">${used ? '✓' : ''}${esc(n)}</span>`;
    }).join('');
    return `<div class="sess ${s.id === activeId ? 'cur' : ''}">
      <span class="nm">${esc(s.title || '课堂')}</span>
      <span class="sub">${esc(s.date || '')} ${esc(s.time || '')} · ${usedCount}/${total} 已到</span>
      ${s.id === activeId ? '' : `<button class="switch" data-id="${s.id}" data-newsid="${s.id}">设为本场</button>`}
      <div class="bars">${chips}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('button[data-newsid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch('/api/session/active', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: btn.dataset.newsid }) });
      loadSessions();
    });
  });
}
function activeName(sessions, activeId){
  for (const s of sessions) if (s.id === activeId) return s.title || '课堂';
  return '未建课';
}
$('btnNewSession').addEventListener('click', async () => {
  const title = $('sTitle').value.trim();
  const date = $('sDate').value.trim();
  const time = $('sTime').value.trim();
  const raw = $('sNumbers').value;
  const numbers = raw.split(/[\s,，;；]+/).map(s => s.trim()).filter(Boolean);
  if (!numbers.length) { $('sessionHint').textContent = '⚠️ 至少填一个上课号'; return; }
  const r = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, time, numbers })
  });
  const res = await r.json();
  if (res.ok) {
    $('sessionHint').textContent = '✅ 本堂课已建好（' + numbers.length + ' 个号），学生现在可以签到';
    $('sNumbers').value = '';
    $('sessionInfo').textContent = '当前场次：' + title + ' —— 学生凭号签到';
    loadSessions();
  } else {
    $('sessionHint').textContent = '⚠️ ' + (res.reason || '新建失败');
  }
});
loadSessions();
setInterval(loadSessions, 5000);

/* ---------- 课堂场次：收起/展开（开课后折叠，不占地方） ---------- */
$('btnToggleSession').addEventListener('click', () => {
  const body = $('sessionBody');
  const btn = $('btnToggleSession');
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  btn.textContent = collapsed ? '收起 ▴' : '展开 ▾';
});

/* ---------- 清空（服务端 + 本机） ---------- */
$('clearBtn').addEventListener('click', async () => {
  if (!confirm('清空全部数据？服务器和学生端所有记录都会删除，重新开始。')) return;
  try { await fetch('/api/clear', { method: 'POST' }); } catch(e) {}
  localStorage.removeItem(EVENT_KEY);
  localStorage.removeItem(TASK_EVENT_KEY);
  events = []; lastTs = 0; selectedSid = null;
  load();
});

/* ---------- 启动 ---------- */
load();
setInterval(load, 2000);
loadClassWater();
setInterval(loadClassWater, 5000);
window.addEventListener('storage', load);
