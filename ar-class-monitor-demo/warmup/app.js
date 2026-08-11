/* ============ 预备课作品 · 表达梳理台 ============
   教学点：对象与目标 —— 从模糊想法到清晰表达
   流程：① 表达初步想法 → ② AI 梳理（对象/目标/怎么做/难点）→ ③ 确认、补充、修正 → 润色成最终表达
   埋点：express_submit / ai_analyzed / confirm_opened / confirm_edit / polished / copied / restarted
   SDK：顷悟平台自动注入，消费者用顷悟账户扣费；前端不塞 system 消息，引导词拼在 user 消息里 */
(async function () {
  'use strict';

  /* ---------- SDK 初始化（顷悟铁律：登录按钮保留、app_id 内联注入、不写 apiKey） ---------- */
  let APP_ID = String(window.QINGWU_APP_ID || '0');
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    try {
      const r = await fetch('./qingwu.json');
      const j = await r.json();
      if (j && j.app_id && String(j.app_id).indexOf('<<') === -1) APP_ID = String(j.app_id);
    } catch (e) { /* file:// 下 fetch 被拦 */ }
  }
  if (APP_ID === '0' || APP_ID.indexOf('<<') !== -1) {
    document.getElementById('analyzeBox').textContent = '应用还没有完成初始化（缺少应用编号）。请回到顷悟客户端里点开这个应用，不要直接双击 html 文件。';
    throw new Error('APP_ID missing');
  }
  if (typeof window.QingwuAI !== 'function') {
    document.getElementById('analyzeBox').textContent = 'AI 组件加载失败，请检查网络后刷新页面重试。';
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
  Track.config({ endpoint: '/api/collect', page: 'warmup', course: '0' });
  const track = (event, payload) => { try { Track.event(event, payload || {}); } catch (e) {} };
  track('page_loaded', { page: 'warmup' });

  /* ---------- 状态 ---------- */
  const $ = id => document.getElementById(id);
  const FIELD_KEYS = ['obj', 'goal', 'how', 'risk'];
  const FIELD_LABELS = { obj: '对象', goal: '目标', how: '怎么做', risk: '难点' };
  const history = [];           // SDK chat 历史
  let ideaText = '';            // 原始想法
  let confirmData = {};         // 确认修正后的四字段
  let analyzing = false;

  /* ---------- 步骤条 ---------- */
  function setStep(n) {
    [1, 2, 3].forEach(i => {
      const el = document.querySelector('.step[data-step="' + i + '"]');
      el.classList.toggle('on', i === n);
      el.classList.toggle('done', i < n);
    });
    $('step1').hidden = n !== 1;
    $('step2').hidden = n !== 2;
    $('step3').hidden = n !== 3;
  }

  /* ---------- 第 1 步：表达想法 → AI 梳理 ---------- */
  $('btnExpress').addEventListener('click', async () => {
    ideaText = $('ideaInput').value.trim();
    if (!ideaText) { alert('先说出你的想法，哪怕很模糊'); return; }
    if (analyzing) return;
    analyzing = true;
    $('btnExpress').disabled = true;
    track('express_submit', { idea: ideaText });

    setStep(2);
    const box = $('analyzeBox');
    box.textContent = '正在梳理你的想法...';

    const prompt = '【表达梳理任务】我有一个想法（还比较模糊）："' + ideaText + '"' +
      '\n请帮我把它梳理清楚，严格按下面 4 个字段回答，每个字段 1-3 行，用中文：' +
      '\n①对象：这个想法主要是给谁用的？（目标用户）' +
      '\n②目标：想解决什么问题、达到什么效果？' +
      '\n③怎么做：大致怎么做？分 1-3 步。' +
      '\n④难点：可能遇到什么困难？';
    history.length = 0;
    history.push({ role: 'user', content: prompt });

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; box.textContent = streamed; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      history.push({ role: 'assistant', content });
      if (!streamed) box.textContent = content;
      track('ai_analyzed', { idea: ideaText, len: content.length });
    } catch (err) {
      box.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
    }
    analyzing = false;
    $('btnExpress').disabled = false;
  });

  /* 换个说法再梳理：回到第 1 步重说 */
  $('btnRework').addEventListener('click', () => { setStep(1); $('ideaInput').focus(); });

  /* ---------- 第 2 步 → 第 3 步：解析 AI 结果到确认表单 ---------- */
  function parseFields(text) {
    const out = {};
    const re = /[①②③④]\s*(?:对象|目标|怎么做|难点)\s*[:：]?\s*([\s\S]*?)(?=[①②③④]|$)/g;
    let m, idx = 0;
    const keys = ['obj', 'goal', 'how', 'risk'];
    while ((m = re.exec(text)) && idx < 4) {
      out[keys[idx]] = m[1].trim().replace(/\n{2,}/g, '\n');
      idx++;
    }
    return { out, ok: idx === 4 };
  }

  $('btnGoConfirm').addEventListener('click', () => {
    const raw = $('analyzeBox').textContent;
    const { out, ok } = parseFields(raw);
    confirmData = { idea: ideaText };
    if (ok) {
      Object.assign(confirmData, out);
    } else {
      // 解析失败：给空表单让学员自己填（也是"确认补充修正"的一部分）
      Object.assign(confirmData, { obj: '', goal: '', how: '', risk: '' });
    }
    renderConfirmForm(ok);
    setStep(3);
    track('confirm_opened', { parsed: ok });
  });

  function renderConfirmForm(parsed) {
    const form = $('confirmForm');
    form.innerHTML = FIELD_KEYS.map(k => `
      <div class="cf-item">
        <label>${FIELD_LABELS[k]}<span class="cf-tag">${k === 'obj' ? '给谁用' : k === 'goal' ? '要什么效果' : k === 'how' ? '大致步骤' : '可能的问题'}</span></label>
        <textarea data-k="${k}" placeholder="${parsed ? '可修改 AI 梳理的内容' : '（AI 未能自动拆分，请自己补充这一项）'}">${(confirmData[k] || '').replace(/</g, '&lt;')}</textarea>
      </div>`).join('') +
      `<div class="cf-item"><label>原始想法<span class="cf-tag">参考</span></label>
       <textarea data-k="idea" readonly>${ideaText.replace(/</g, '&lt;')}</textarea></div>`;
    form.querySelectorAll('textarea[data-k]').forEach(ta => {
      ta.addEventListener('input', () => {
        if (ta.dataset.k !== 'idea') {
          confirmData[ta.dataset.k] = ta.value;
          track('confirm_edit', { field: ta.dataset.k, value: ta.value });
        }
      });
    });
  }

  /* ---------- 第 3 步：润色成最终表达 ---------- */
  $('btnPolish').addEventListener('click', async () => {
    // 收集当前表单值
    $('confirmForm').querySelectorAll('textarea[data-k]').forEach(ta => {
      if (ta.dataset.k !== 'idea') confirmData[ta.dataset.k] = ta.value;
    });
    const filled = FIELD_KEYS.filter(k => confirmData[k] && confirmData[k].trim());
    if (filled.length < 4) { alert('还差 ' + (4 - filled.length) + ' 项没填，补充完整再润色'); return; }

    $('btnPolish').disabled = true;
    $('btnPolish').textContent = '润色中...';
    const finalBox = $('finalText');
    $('finalCard').hidden = false;
    finalBox.textContent = '正在生成最终表达...';

    const prompt = '【确认修正】这是我确认后的想法（已按对象/目标/怎么做/难点整理）：' +
      '\n对象：' + confirmData.obj +
      '\n目标：' + confirmData.goal +
      '\n怎么做：' + confirmData.how +
      '\n难点：' + confirmData.risk +
      '\n请帮我润色成一段清晰、完整、让别人一看就懂的「清晰表达」，100-200 字，语气积极自然，不要列①②③。';
    history.push({ role: 'user', content: prompt });

    let streamed = '';
    try {
      const res = await ai.chat(history, {
        stream: true,
        onDelta: (d) => { streamed += d; finalBox.textContent = streamed; }
      });
      updateLoginState(true);
      const content = (res && res.content) || streamed;
      history.push({ role: 'assistant', content });
      if (!streamed) finalBox.textContent = content;
      track('polished', { idea: ideaText, len: content.length });
    } catch (err) {
      finalBox.textContent = '出错了: ' + (err && err.message || err);
      console.error(err);
    }
    $('btnPolish').disabled = false;
    $('btnPolish').textContent = '✨ 润色成清晰表达';
  });

  $('btnCopy').addEventListener('click', () => {
    const text = $('finalText').textContent;
    if (!text || text.indexOf('正在') === 0) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); alert('已复制 ✅'); track('copied', {}); } catch (e) {}
    document.body.removeChild(ta);
  });

  $('btnRestart').addEventListener('click', () => {
    $('ideaInput').value = '';
    $('finalCard').hidden = true;
    history.length = 0;
    setStep(1);
    track('restarted', {});
  });

  // 回车提交想法
  $('ideaInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('btnExpress').click();
  });
})();
