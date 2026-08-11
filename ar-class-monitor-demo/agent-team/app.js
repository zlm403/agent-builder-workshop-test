/* ============ 下午综合课作品 · 多员工应用工坊 ============
   教学点：能力与工具 —— 从单个员工到能力系统
   流程：① 目标 → ② AI 拆能力 → ③ 配员工（改名/职责/选工具）→ ④ 设计交接 → ⑤ 测试员工 + 发布团队说明书
   埋点：goal_submit / abilities_generated / employee_configured / tool_selected / handoff_designed / test_message / published
   SDK：顷悟平台自动注入，前端不塞 system 消息，员工人格拼在 user 消息里 */
(async function () {
  'use strict';

  /* ---------- SDK 初始化 ---------- */
  let APP_ID = String(window.QINGWU_APP_ID || '0');
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    try {
      const r = await fetch('./qingwu.json');
      const j = await r.json();
      if (j && j.app_id && String(j.app_id).indexOf('<<') === -1) APP_ID = String(j.app_id);
    } catch (e) {}
  }
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    document.getElementById('abilityBox').textContent = '应用还没有完成初始化（缺少应用编号）。请回到顷悟客户端里点开这个应用。';
    throw new Error('APP_ID missing');
  }
  if (typeof window.QingwuAI !== 'function') {
    document.getElementById('abilityBox').textContent = 'AI 组件加载失败，请检查网络后刷新页面重试。';
    throw new Error('SDK missing');
  }

  const ai = new QingwuAI({ appId: APP_ID });
  ai.on('onBeforeCostly', (info) => window.confirm('即将' + info.label + ', 约 ¥' + info.estimatedYuan + ', 继续?'));
  ai.on('onUnauthenticated', () => updateLoginState(false));
  ai.on('onInsufficientBalance', () => alert('账户余额不足, 请充值后再试'));
  ai.on('onAppOffShelf', () => alert('应用已被创作者下架'));
  ai.on('onCapabilityNotEnabled', (cap) => alert('本应用不支持 ' + cap + ' 能力'));

  const loginBtn = document.getElementById('loginBtn');
  function updateLoginState(ok) {
    loginBtn.textContent = ok ? '已登录' : '未登录 · 点击登录';
    loginBtn.className = 'login-btn' + (ok ? ' on' : '');
  }
  updateLoginState(ai.isLoggedIn());
  loginBtn.addEventListener('click', async () => {
    try { await ai.requireLogin(); updateLoginState(true); } catch (e) {}
  });

  /* ---------- 埋点 ---------- */
  Track.config({ endpoint: '/api/collect', page: 'agent-team', course: '4' });
  const track = (event, payload) => { try { Track.event(event, payload || {}); } catch (e) {} };
  track('page_loaded', { page: 'agent-team' });

  /* ---------- 状态 ---------- */
  const $ = id => document.getElementById(id);
  const TOOLS = ['资料库', '表单', '模板', '计算器', '日历', '地图', '图片库', '报表'];
  const AVATARS = ['🎯', '📣', '📦', '🎪', '💰', '🚨', '💬', '👨‍💻', '🧭', '🛠'];
  let goalText = '';
  let abilities = [];      // [{name, duty}]
  let staffs = [];         // [{id, name, duty, tools:[], history:[], avatar}]
  let handoffs = [];       // [{from, to, note}]
  let currentStaffId = null;
  let busy = false;

  /* ---------- 步骤条 ---------- */
  function setStep(n) {
    [1, 2, 3, 4, 5].forEach(i => {
      const el = document.querySelector('.step[data-step="' + i + '"]');
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
    });
    for (let i = 1; i <= 5; i++) $('step' + i).hidden = i !== n;
  }

  /* ---------- 第 1 步：目标 → 拆能力 ---------- */
  $('btnBreak').addEventListener('click', async () => {
    goalText = $('goalInput').value.trim();
    if (!goalText) { alert('先写一个目标'); return; }
    if (busy) return;
    busy = true;
    $('btnBreak').disabled = true;
    track('goal_submit', { goal: goalText });

    setStep(2);
    const box = $('abilityBox');
    box.textContent = '正在从目标拆解能力...';

    const prompt = '【能力拆解任务】用户希望做一个 AI 应用来完成这个目标："' + goalText + '"。' +
      '\n请把这个目标拆成 3-5 个能力（每个能力对应一名 AI 员工，即一个对话角色）。' +
      '\n严格按下面格式输出，每行一个能力，不要输出其它内容：' +
      '\n【能力1】能力名｜这个员工负责做什么（一句话职责）' +
      '\n【能力2】能力名｜职责...';
    const history = [{ role: 'user', content: prompt }];

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; box.textContent = streamed; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      if (!streamed) box.textContent = content;
      abilities = parseAbilities(content);
      if (!abilities.length) abilities = fallbackAbilities(goalText);
      track('abilities_generated', { goal: goalText, count: abilities.length });
    } catch (err) {
      box.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
      abilities = fallbackAbilities(goalText);
    }
    busy = false;
    $('btnBreak').disabled = false;
  });

  function parseAbilities(text) {
    const out = [];
    const re = /【能力\d+】\s*([^｜|]+?)\s*[｜|]\s*([^\n]+)/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1].trim();
      const duty = m[2].trim();
      if (name && duty) out.push({ name, duty });
    }
    return out;
  }
  function fallbackAbilities(goal) {
    return [
      { name: '策划', duty: '负责围绕目标「' + goal + '」做整体策划与步骤设计' },
      { name: '执行', duty: '负责把策划落地成具体行动和物料' },
      { name: '审核', duty: '负责检查产出是否完整、有没有漏洞' }
    ];
  }

  $('btnReworkGoal').addEventListener('click', () => { setStep(1); $('goalInput').focus(); });

  /* ---------- 第 2 步 → 第 3 步：配员工 ---------- */
  $('btnToStaff').addEventListener('click', () => {
    staffs = abilities.map((a, i) => ({
      id: 's' + i,
      name: a.name,
      duty: a.duty,
      tools: [],
      history: [],
      avatar: AVATARS[i % AVATARS.length]
    }));
    renderStaffList();
    setStep(3);
    track('employee_configured', { count: staffs.length });
  });

  function renderStaffList() {
    const list = $('staffList');
    list.innerHTML = staffs.map((s, i) => `
      <div class="staff" data-id="${s.id}">
        <div class="staff-head">
          <div class="staff-avatar">${s.avatar}</div>
          <input class="staff-edit staff-name" value="${s.name.replace(/</g, '&lt;')}" data-field="name">
          <div class="staff-role">${s.duty.replace(/</g, '&lt;')}</div>
        </div>
        <div class="tools">
          <div class="t-label">🔧 选择这个员工使用的工具：</div>
          ${TOOLS.map(t => `<span class="tool${s.tools.indexOf(t) >= 0 ? ' on' : ''}" data-tool="${t}">${t}</span>`).join('')}
        </div>
      </div>`).join('');

    list.querySelectorAll('.staff').forEach(card => {
      const id = card.dataset.id;
      const s = staffs.find(x => x.id === id);
      card.querySelector('input.staff-name').addEventListener('input', e => {
        s.name = e.target.value.trim() || s.name;
      });
      card.querySelectorAll('.tool').forEach(t => {
        t.addEventListener('click', () => {
          const tool = t.dataset.tool;
          const idx = s.tools.indexOf(tool);
          if (idx >= 0) s.tools.splice(idx, 1); else s.tools.push(tool);
          t.classList.toggle('on');
          track('tool_selected', { staff: s.name, tool, on: idx < 0 });
        });
      });
    });
  }

  /* ---------- 第 3 步 → 第 4 步：交接 ---------- */
  $('btnToHandoff').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    $('btnToHandoff').disabled = true;
    setStep(4);
    const box = $('handoffBox');
    box.hidden = false;
    box.textContent = '正在设计交接链...';

    const staffDesc = staffs.map((s, i) => (i + 1) + '. ' + s.name + '（' + s.duty + '）').join('\n');
    const prompt = '【交接设计任务】我的 AI 应用团队有这些员工：\n' + staffDesc +
      '\n请设计一条交接链：哪个员工先做完，把产出交给哪个员工继续。' +
      '\n严格按下面格式输出，每行一条：' +
      '\n1. 员工A → 员工B：交接说明' +
      '\n要求：尽量让每个员工都出现在链上，交接说明一句话讲清 A 把什么交给 B。';
    const history = [{ role: 'user', content: prompt }];

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; box.textContent = streamed; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      if (!streamed) box.textContent = content;
      handoffs = parseHandoffs(content);
      if (!handoffs.length) handoffs = fallbackHandoffs();
      renderHandoffList();
      track('handoff_designed', { count: handoffs.length });
    } catch (err) {
      box.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
      handoffs = fallbackHandoffs();
      renderHandoffList();
    }
    busy = false;
    $('btnToHandoff').disabled = false;
  });

  function parseHandoffs(text) {
    const out = [];
    const re = /^\s*(\d+)[.、)\s]\s*(.+?)\s*[→➡]\s*(.+?)[：:]\s*(.+)$/gm;
    let m;
    while ((m = re.exec(text))) {
      const from = m[2].trim();
      const to = m[3].trim();
      const note = m[4].trim();
      if (from && to) out.push({ from, to, note });
    }
    return out;
  }
  function fallbackHandoffs() {
    const names = staffs.map(s => s.name);
    const out = [];
    for (let i = 0; i < names.length - 1; i++) {
      out.push({ from: names[i], to: names[i + 1], note: '把上一阶段产出交给下一环节继续处理' });
    }
    return out;
  }

  function renderHandoffList() {
    const list = $('handoffList');
    list.innerHTML = handoffs.map((h, i) => `
      <div class="handoff-item">
        <div class="handoff-idx">${i + 1}</div>
        <div class="handoff-info">
          <div class="h-name">${h.from.replace(/</g, '&lt;')} → ${h.to.replace(/</g, '&lt;')}</div>
          <div class="h-duty">${(h.note || '').replace(/</g, '&lt;')}</div>
        </div>
        <div class="row-right" style="margin:0">
          <button class="small" data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="small" data-act="down" ${i === handoffs.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.closest('.handoff-item').querySelector('.handoff-idx').textContent, 10) - 1;
        const dir = btn.dataset.act === 'up' ? -1 : 1;
        const j = idx + dir;
        if (j < 0 || j >= handoffs.length) return;
        [handoffs[idx], handoffs[j]] = [handoffs[j], handoffs[idx]];
        renderHandoffList();
        track('handoff_reordered', {});
      });
    });
  }

  /* ---------- 第 4 步 → 第 5 步：测试 + 发布 ---------- */
  $('btnToTest').addEventListener('click', () => {
    setStep(5);
    renderStaffTabs();
    selectStaff(staffs[0] ? staffs[0].id : null);
  });

  function renderStaffTabs() {
    const tabs = $('staffTabs');
    tabs.innerHTML = staffs.map(s =>
      `<button class="staff-tab" data-id="${s.id}" type="button">${s.avatar} ${s.name.replace(/</g, '&lt;')}</button>`
    ).join('');
    tabs.querySelectorAll('.staff-tab').forEach(t => {
      t.addEventListener('click', () => selectStaff(t.dataset.id));
    });
  }

  function selectStaff(id) {
    currentStaffId = id;
    document.querySelectorAll('.staff-tab').forEach(t => {
      t.classList.toggle('on', t.dataset.id === id);
    });
    const box = $('chatBox');
    const s = staffs.find(x => x.id === id);
    if (!s) { box.innerHTML = ''; return; }
    if (!s.history.length) {
      box.innerHTML = '<div class="msg assistant"><div class="bubble">我是「' + s.name + '」，职责：' + s.duty +
        (s.tools.length ? '，我用的工具：' + s.tools.join('、') : '') + '。你可以问我任何与团队目标相关的问题。</div></div>';
    } else {
      box.innerHTML = s.history.map(m =>
        '<div class="msg ' + m.role + '"><div class="bubble">' + esc(m.content) + '</div></div>'
      ).join('');
    }
    box.scrollTop = 1e9;
  }

  function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  $('btnSend').addEventListener('click', async () => {
    const text = $('chatInput').value.trim();
    if (!text || !currentStaffId || busy) return;
    const s = staffs.find(x => x.id === currentStaffId);
    if (!s) return;
    busy = true;
    $('btnSend').disabled = true;

    const box = $('chatBox');
    box.insertAdjacentHTML('beforeend', '<div class="msg user"><div class="bubble">' + esc(text) + '</div></div>');
    box.scrollTop = 1e9;
    $('chatInput').value = '';
    track('test_message', { staff: s.name, text });

    const persona = '【你是这个 AI 应用团队的员工】角色名：' + s.name + '；职责：' + s.duty +
      (s.tools.length ? '；你使用的工具：' + s.tools.join('、') : '') +
      '；团队目标：' + goalText +
      '。请始终以这个员工的视角回答，回答要专业、具体、可执行，200 字以内。';
    const history = s.history;
    if (!history.length) history.push({ role: 'user', content: persona + '\n\n用户说：' + text });
    else history.push({ role: 'user', content: text });

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '思考中...';
    box.insertAdjacentHTML('beforeend', '<div class="msg assistant"></div>');
    const msgEl = box.lastElementChild;
    msgEl.appendChild(bubble);
    box.scrollTop = 1e9;

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; bubble.textContent = streamed; box.scrollTop = 1e9; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      if (!streamed) bubble.textContent = content;
      history.push({ role: 'assistant', content });
      selectStaff(s.id); // 重绘（保持历史一致）
    } catch (err) {
      bubble.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
    }
    busy = false;
    $('btnSend').disabled = false;
  });
  $('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnSend').click(); });

  /* ---------- 发布：团队说明书 ---------- */
  $('btnPublish').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    $('btnPublish').disabled = true;
    const p = $('publishText');
    $('publishCard').hidden = false;
    p.textContent = '正在生成团队说明书...';

    const staffDesc = staffs.map((s, i) => (i + 1) + '. ' + s.name + '：' + s.duty + (s.tools.length ? '，工具：' + s.tools.join('、') : '')).join('\n');
    const handoffDesc = handoffs.map((h, i) => (i + 1) + '. ' + h.from + ' → ' + h.to + '：' + (h.note || '')).join('\n');
    const prompt = '【团队说明书】请为这个 AI 应用生成一份「团队说明书」，markdown 格式：' +
      '\n- 应用名称：根据目标「' + goalText + '」起一个名字' +
      '\n- 目标：' + goalText +
      '\n- 员工列表（角色/职责/工具）：\n' + staffDesc +
      '\n- 交接链：\n' + handoffDesc +
      '\n- 使用方法：用户怎么用这个应用（1-3 步）' +
      '\n- 测试结论：上线前应该测试什么';
    const history = [{ role: 'user', content: prompt }];

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; p.textContent = streamed; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      if (!streamed) p.textContent = content;
      track('published', { goal: goalText, staffs: staffs.length, handoffs: handoffs.length });
    } catch (err) {
      p.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
    }
    busy = false;
    $('btnPublish').disabled = false;
  });

  $('btnCopy').addEventListener('click', () => {
    const text = $('publishText').textContent;
    if (!text || text.indexOf('正在') === 0) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); alert('已复制 ✅'); track('copied', {}); } catch (e) {}
    document.body.removeChild(ta);
  });

  $('btnRestart').addEventListener('click', () => {
    $('goalInput').value = '';
    $('publishCard').hidden = true;
    abilities = []; staffs = []; handoffs = [];
    setStep(1);
    track('restarted', {});
  });
})();
