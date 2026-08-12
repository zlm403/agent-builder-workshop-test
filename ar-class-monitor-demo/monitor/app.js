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
function renderAll(){ renderClassPrism(); renderStudents(); renderTimeline(); renderXray(); }

/* ---------- 班级理解棱镜（一核多表：每课各穿各自的维度表） ---------- */
function taskOfCourse(c){
  if (c === 'pre') return 'pre';
  if (c === '1') return 't1';
  if (c === '2') return 't2';
  if (c === '4') return 't3';
  return null;
}
const STATE_ORDER = ['ok', 'rec', 'guess', 'clarify', 'empty', 'conflict'];
function renderClassPrism(){
  const task = taskOfCourse(courseFilter);
  const grid = $('prismGrid');
  if (!task) {
    grid.innerHTML = '<div class="empty">选择上方课程后查看班级棱镜</div>';
    $('prismInfo').textContent = '（先选课程，看这一课全班哪里没立住）';
    return;
  }
  const matched = events.filter(e => taskIdOf(e.payload) === task && e.sid !== 'teacher');
  const perStu = {};
  matched.forEach(e => {
    if (!perStu[e.sid]) perStu[e.sid] = [];
    perStu[e.sid].push({ event: e.event, payload: e.payload });
  });
  const sids = Object.keys(perStu);
  $('prismInfo').textContent = COURSE_NAME[courseFilter] + ' · ' + sids.length + ' 名学生参与';
  if (!sids.length) { grid.innerHTML = '<div class="empty">该课暂无学生数据</div>'; return; }

  const cells = Analyzer.CELLS_BY_TASK[task];
  const counts = cells.map(() => ({}));
  sids.forEach(sid => {
    const r = Analyzer.clarityFor(task, perStu[sid]);
    r.grid.forEach((c, i) => {
      counts[i][c.state] = (counts[i][c.state] || 0) + 1;
    });
  });

  grid.innerHTML = cells.map((c, i) => {
    const cnt = counts[i];
    let best = 'empty', bv = -1;
    STATE_ORDER.forEach(k => { if ((cnt[k] || 0) > bv) { bv = cnt[k] || 0; best = k; } });
    const miss = (cnt.guess || 0) + (cnt.clarify || 0) + (cnt.empty || 0) + (cnt.conflict || 0)
      > (cnt.ok || 0) + (cnt.rec || 0);
    const st = Analyzer.STATE[best];
    const pct = sids.length ? Math.round(bv / sids.length * 100) : 0;
    return `<div class="prism-cell ${miss ? 'gap' : ''}">
      <div class="pn">${i + 1}. ${c.name}</div>
      <div class="pv">${st.sym} ${st.label} ${pct}%</div>
      <div class="ps ${best}">${bv}/${sids.length} 人</div>
    </div>`;
  }).join('');
}

/* ---------- 任务推送（带课程标记） ---------- */
$('btnPush').addEventListener('click', () => {
  const title = $('tTitle').value.trim();
  if (!title) { alert('先填任务标题'); return; }
  const course = (courseFilter === 'all') ? '' : courseFilter;
  const payload = {
    _ts: Date.now(),
    course,
    task_no: $('tNo').value.trim() || '任务',
    title,
    desc: $('tDesc').value.trim(),
    goal: $('tGoal').value.trim(),
    steps: $('tSteps').value.trim(),
  };
  const rec = { ts: Date.now(), sid: 'teacher', course, event: 'task_push', payload };
  // 独立槽：学生端秒读最新任务（带课程）
  try { localStorage.setItem(TASK_EVENT_KEY, JSON.stringify(rec)); } catch(e){}
  // 事件流：本地 + 服务端
  try {
    const arr = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
    arr.push(rec);
    localStorage.setItem(EVENT_KEY, JSON.stringify(arr));
  } catch(e){}
  fetch(COLLECT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }).catch(() => {});
  const target = course ? COURSE_NAME[course] : '全部课程';
  $('pushHint').textContent = `✅ 已推送给「${target}」：「${payload.task_no} · ${title}」`;
  setTimeout(() => { $('pushHint').textContent = '推送后对应课程学生端会自动收到'; }, 6000);
});

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
    if (e.event === 'student_ask') {
      map[e.sid].lastAsk = e.payload.text || '';
      map[e.sid].lastAskTs = e.ts;
    }
  });
  const sids = Object.keys(map).sort((a, b) => map[b].last - map[a].last);
  $('stEvents').textContent = matched.length;
  $('stStudents').textContent = sids.length;
  $('stFinish').textContent = sids.filter(s => map[s].done).length;
  $('stAgent').textContent = sids.reduce((n, s) => n + map[s].agent, 0);
  $('stWork').textContent = sids.reduce((n, s) => n + map[s].work, 0);
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
        <span class="nm">${s}</span>${m.lastAsk ? '<span class="ask-badge" title="' + esc(m.lastAsk) + '">💬</span>' : ''}
        <span class="ct">${m.count} 事件${m.agent ? ' · 🤖' + m.agent : ''}${m.work ? ' · 🎮' + m.work : ''} · ${ago}s 前</span>${m.done ? '<span class="ok">✓完成</span>' : ''}
        ${m.lastAsk ? `<div class="ask-msg" onclick="event.stopPropagation()">💬 ${esc(m.lastAsk)}</div>` : ''}
      </div>
      ${ringHtml}
    </div>`;
  }).join('');
}
window.selectSid = function(s){
  selectedSid = (selectedSid === s) ? null : s;
  renderAll();
};

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
window.addEventListener('storage', load);
