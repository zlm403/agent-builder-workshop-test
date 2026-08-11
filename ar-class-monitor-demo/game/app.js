/* ============ 第一课作品 · 答疑闯关游戏 ============
   教学点：资料与边界
   - 有依据地回答：答对/答错都展示「依据」
   - 限定知识范围：边界测试，资料外问题拒绝回答
   埋点：game_start / question_answered / game_over / boundary_test */

Track.config({ endpoint: '/api/collect', page: 'lesson1-game', course: '1' });

const $ = id => document.getElementById(id);
const QUESTIONS = (window.LESSON_DATA && LESSON_DATA.questions) || [];
const SCOPE = (window.LESSON_DATA && LESSON_DATA.scope) || [];
const TOTAL = 5;              // 每局抽题数
const SCORE_PER = 20;         // 每题得分

let quiz = [];                // 本局题目（已乱序）
let quizIdx = 0;
let score = 0;
let correctCount = 0;

/* ---------- Tab 切换 ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === btn));
    ['play', 'boundary', 'data'].forEach(p => $('#' + p).hidden = (p !== btn.dataset.panel));
    if (btn.dataset.panel === 'data') renderData();
  });
});

/* ---------- 闯关 ---------- */
function shuffle(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

$('btnStart').addEventListener('click', () => {
  if (!QUESTIONS.length) { alert('资料库还是空的，先去「📚 我的资料库」或编辑 data.js'); return; }
  quiz = shuffle(QUESTIONS).slice(0, Math.min(TOTAL, QUESTIONS.length));
  quizIdx = 0; score = 0; correctCount = 0;
  $('playReady').hidden = true;
  $('playResult').hidden = true;
  $('playQuiz').hidden = false;
  Track.event('game_start', { total: quiz.length });
  renderQuestion();
});

function renderQuestion(){
  const q = quiz[quizIdx];
  $('qProgress').textContent = `第 ${quizIdx + 1} / ${quiz.length} 题`;
  $('qScore').textContent = `${score} 分`;
  $('qText').textContent = q.q;
  $('qOptions').innerHTML = q.options.map((opt, i) =>
    `<button class="opt" data-i="${i}" type="button">${String.fromCharCode(65 + i)}. ${opt.replace(/</g,'&lt;')}</button>`
  ).join('');
  $('qFeedback').hidden = true;
  $('btnNext').hidden = true;
  document.querySelectorAll('#qOptions .opt').forEach(b => {
    b.addEventListener('click', () => answer(b.dataset.i));
  });
}

function answer(i){
  const q = quiz[quizIdx];
  const ok = (+i === q.answer);
  if (ok) { score += SCORE_PER; correctCount++; }
  const fb = $('qFeedback');
  fb.hidden = false;
  fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
  fb.innerHTML = (ok ? '✅ 回答正确！' : '❌ 答错了。')
    + '<div class="basis">📖 依据：' + q.basis.replace(/</g,'&lt;') + '</div>';
  document.querySelectorAll('#qOptions .opt').forEach(b => {
    b.disabled = true;
    b.classList.toggle('right', +b.dataset.i === q.answer);
    b.classList.toggle('wrong', +b.dataset.i === +i && !ok);
  });
  Track.event('question_answered', { correct: ok, score, idx: quizIdx });
  $('btnNext').hidden = false;
  $('btnNext').textContent = (quizIdx + 1 >= quiz.length) ? '🏁 查看结果' : '下一题 ▶';
}

$('btnNext').addEventListener('click', () => {
  quizIdx++;
  if (quizIdx >= quiz.length) {
    $('playQuiz').hidden = true;
    $('playResult').hidden = false;
    $('resultTitle').textContent = correctCount === quiz.length ? '🎉 全对通关！' : (correctCount >= quiz.length / 2 ? '👍 闯关成功！' : '💪 再试一次！');
    $('resultScore').textContent = `${score} 分`;
    $('resultDetail').textContent = `答对 ${correctCount} / ${quiz.length} 题`;
    Track.event('game_over', { score, correct: correctCount, total: quiz.length });
  } else {
    renderQuestion();
  }
});

$('btnAgain').addEventListener('click', () => { $('playResult').hidden = true; $('playReady').hidden = false; });

/* ---------- 边界测试 ---------- */
function findInScope(text){
  const hit = SCOPE.filter(k => text.toLowerCase().includes(k.toLowerCase()));
  if (!hit.length) return { inScope: false, hit: [] };
  // 资料内：尝试找最匹配的题
  let best = null;
  QUESTIONS.forEach(q => {
    const score = q.q.split('').filter((c, i) => text.includes(q.q.slice(Math.max(0, i - 2), i + 3))).length;
    // 简化匹配：问题关键词重合度
    const kw = q.q.replace(/[，。？?：:]/g, ' ').split(' ').filter(s => s.length > 1);
    const hitN = kw.filter(k => text.includes(k)).length;
    if (hitN > 0 && (!best || hitN > best._hit)) best = { ...q, _hit: hitN };
  });
  return { inScope: true, hit, best };
}

$('btnTest').addEventListener('click', () => {
  const text = $('btInput').value.trim();
  if (!text) { alert('先输入一个问题'); return; }
  const r = findInScope(text);
  const box = $('btResult');
  box.hidden = false;
  if (!r.inScope) {
    box.className = 'bt-result out';
    box.innerHTML = `<div class="bt-title">⛔ 资料外问题 —— AI 拒绝回答</div>
      <div class="bt-body">这个问题不在我的资料范围内（未命中：${SCOPE.join(' / ') || '(无)'}）。</div>
      <div class="basis">📖 教学点：有依据地回答 —— 没有资料依据，就不能瞎答。</div>`;
  } else if (r.best) {
    box.className = 'bt-result in';
    box.innerHTML = `<div class="bt-title">✅ 资料内问题 —— AI 有依据地回答</div>
      <div class="bt-body"><b>${r.best.q}</b><br>答：${r.best.options[r.best.answer]}</div>
      <div class="basis">📖 依据：${r.best.basis.replace(/</g,'&lt;')}</div>`;
  } else {
    box.className = 'bt-result mid';
    box.innerHTML = `<div class="bt-title">⚠️ 命中资料关键词，但没有完整条目</div>
      <div class="bt-body">命中关键词：${r.hit.join(' / ')}。建议把这类问题补进资料库（data.js）。</div>
      <div class="basis">📖 教学点：资料边界要清楚 —— 模棱两可时宁可说"资料待补充"。</div>`;
  }
  Track.event('boundary_test', { inScope: r.inScope, question: text });
});
$('btInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnTest').click(); });

/* ---------- 资料库展示 ---------- */
function renderData(){
  $('dataCount').textContent = QUESTIONS.length + ' 题';
  $('dataIntro').textContent = (window.LESSON_DATA && LESSON_DATA.intro) || '';
  $('dataList').innerHTML = QUESTIONS.map((q, i) => `
    <div class="d-item">
      <div class="d-q"><b>Q${i + 1}.</b> ${q.q.replace(/</g,'&lt;')}</div>
      <div class="d-opts">${q.options.map((o, j) => (j === q.answer ? '✅ ' : '') + o.replace(/</g,'&lt;')).join('  |  ')}</div>
      <div class="d-basis">📖 ${q.basis.replace(/</g,'&lt;')}</div>
    </div>`).join('') || '<div class="dim">资料库为空，请编辑 data.js</div>';
}

/* ---------- 启动 ---------- */
renderData();
Track.event('page_loaded', { page: 'lesson1-game' });
