'use client';
// =========================================================
// A0 新版 · 学生端组件（覆盖 A0-1 三问 / A0-2 关系题 / A0-3 揭晓等待 / 滑杆）
// =========================================================
import { useEffect, useState } from 'react';
import { A0_QUESTIONS, A0_QUESTIONS_GUIDE, A0_SLIDER_STEPS, A0_SLIDERS } from '@/features/avatarLesson/config';

export default function AvatarA0Student({
  type,
  anonymousId,
  sessionId,
  locked,
  moduleStatus,
  submitted,
  onSubmitted,
  currentTitle,
  subState,
}: {
  type: string; // A0N_QUESTIONS | A0N_VOTE | A0N_REVEAL
  anonymousId: string;
  sessionId: string;
  locked: boolean;
  moduleStatus: string;
  submitted: boolean;
  onSubmitted: () => void;
  currentTitle?: string;
  subState?: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sliders, setSliders] = useState<Record<string, number>>({});

  // 恢复已提交内容
  useEffect(() => {
    if (submitted && moduleStatus === 'submitted') {
      // 已提交则显示完成态
    }
  }, [submitted, moduleStatus]);

  const qs = A0_QUESTIONS;

  async function submitQuestions() {
    const filled = qs.every((q) => (answers[q.key] ?? '').trim().length > 0);
    if (!filled || busy || locked) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/avatar/a0/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, sessionId, answers }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error?.code === 'MODULE_LOCKED' ? '本环节已截止/锁定' : '提交失败');
        return;
      }
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  // 三问
  if (type === 'A0N_QUESTIONS') {
    const s = String(subState ?? '');
    // 开场页（P1 手指图 / P2 二维图）：学生端请看大屏
    if (s === 'a0:intro1' || s === 'a0:intro2') {
      return (
        <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
          <p className="note">老师正在讲"你和 AI 的故事"，跟着大屏一起看。</p>
        </div>
      );
    }
    return (
      <div>
        <p className="task-prompt" style={{ color: '#fbbf24', fontWeight: 600 }}>
          {A0_QUESTIONS_GUIDE}
        </p>
        {qs.map((q, i) => (
          <div key={q.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>{i + 1}. {q.title}</label>
            <textarea
              placeholder={q.placeholder}
              value={answers[q.key] ?? ''}
              disabled={busy || locked || submitted}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
              style={{ minHeight: 80 }}
            />
          </div>
        ))}
        {submitted ? (
          <p className="note" style={{ color: 'var(--green)' }}>已提交，系统正在整理大家的回答，请看大屏。</p>
        ) : (
          <>
            <button disabled={busy || locked || qs.some((q) => !(answers[q.key] ?? '').trim())} onClick={submitQuestions} className="primary" style={{ width: '100%' }}>
              {busy ? '提交中…' : '提交'}
            </button>
            {msg ? <p style={{ color: 'var(--red)', marginTop: 8 }}>{msg}</p> : null}
          </>
        )}
      </div>
    );
  }

  // A0-2 关系判定中：系统后台判定，学生端不打扰，请看大屏
  if (type === 'A0N_VOTE') {
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">系统正在分析每一位同学与 AI 的关系，一起看大屏上的结果。</p>
      </div>
    );
  }

  // A0-3 揭晓等待：请看大屏；教师推送到三种形态(reveal:2)时显示滑杆（不提交，纯感受）
  if (type === 'A0N_REVEAL') {
    const ss = String(subState ?? '');
    // 镜子 / 收束页：学生端请看大屏
    if (ss === 'a0:mirror') {
      return (
        <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>看看自己，在哪儿</div>
          <p className="note">跟着大屏，停下来想一想：AI 已经走到这里了，我在哪个位置？</p>
        </div>
      );
    }
    if (ss === 'a0:closing') {
      return (
        <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
          <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
          <p className="note">老师正在讲"这个东西已经来了"，一起看大屏上的证据。</p>
        </div>
      );
    }
    // 三种形态（reveal:2）时推滑块：学生自己滑，感受人和 AI 的分工，不提交
    const isSliderOpen = ss.startsWith('reveal:2');
    if (isSliderOpen) {
      return (
        <div className="a0-slider-wrap">
          <div className="a0-slider-title">{A0_SLIDERS.title}</div>
          <p className="a0-slider-sub">做一件事，每一步到底谁更适合？把 6 条都滑到你心里的位置——最左全由人做，最右全交给 AI。滑着感受一下就好，不用提交。</p>
          {A0_SLIDER_STEPS.map((s, i) => (
            <div key={s.key} className="a0-slider-row">
              <div className="a0-slider-label">{s.label}</div>
              {s.hint ? <div className="a0-slider-hint">{s.hint}</div> : null}
              <div className="a0-slider-track">
                <span className="a0-slider-end a0-slider-end-human">人</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={typeof sliders[s.key] === 'number' ? sliders[s.key] : 50}
                  disabled={locked}
                  onChange={(e) => setSliders((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                  className="a0-range"
                  style={{
                    ['--val' as string]: `${typeof sliders[s.key] === 'number' ? sliders[s.key] : 50}%`,
                  }}
                />
                <span className="a0-slider-end a0-slider-end-ai">AI</span>
              </div>
              <div className="a0-slider-readout">
                {typeof sliders[s.key] === 'number'
                  ? sliders[s.key] <= 40
                    ? '偏人 · 人来做'
                    : sliders[s.key] >= 60
                      ? '偏AI · 交给 AI'
                      : '人机一起'
                  : '未滑动'}
              </div>
            </div>
          ))}
          <p className="note" style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
            不用提交，跟着老师边听边滑，感受一下人和 AI 的分工变化。
          </p>
        </div>
      );
    }
    return (
      <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
        <p className="note">老师正在揭晓全班的答案，并讲解「把 AI 当工具 vs 当伙伴」的三种形态区别。跟着大屏一起看。</p>
      </div>
    );
  }

  // 其它情况（A0N_VOTE 已在上方 return；此处兜底请看大屏）
  return (
    <div className="module-card" style={{ textAlign: 'center', paddingTop: '6vh' }}>
      <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>请看大屏</div>
      <p className="note">请跟着老师的节奏，一起看大屏。</p>
    </div>
  );
}
