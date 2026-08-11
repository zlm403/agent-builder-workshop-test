import { useState } from 'react';

interface Props {
  anonymousId: string;
  sessionId: string;
}

// 学生端「AI 标签候场室 · 暖场弹幕」：
// 入场后/开课前，先写一条对 AI 的认知想法发到大屏弹幕；可多次发送；等待教师开启。
export default function StudentWaitingRoom({ anonymousId, sessionId }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState('');

  async function send() {
    const t = text.trim();
    if (!t || busy || !sessionId) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/classroom/${sessionId}/thoughts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId, text: t }),
      });
      if (res.ok) {
        setText('');
        setSent((n) => n + 1);
      } else {
        let msg = '发送失败，请稍后再试';
        try {
          const d = await res.json();
          if (d?.error?.code === 'CENSORED') msg = '请文明用语，这句话不能上大屏';
          else if (d?.error?.code === 'NOT_JOINED') msg = '你还未入场，请先扫码进入课堂';
          else if (d?.error?.code === 'SESSION_CLOSED') msg = '课堂已结束，无法再发弹幕';
        } catch {
          /* ignore */
        }
        setErr(msg);
      }
    } catch {
      setErr('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="student-waiting">
      <div className="sw-top">
        <span className="sw-brand">AI 职业能力体验</span>
        <span className="sw-id">已进入 · {anonymousId}</span>
      </div>

      <div className="sw-stage">
        <div className="sw-avatar">
          <div className="sw-frame">
            <svg className="sw-bust" viewBox="0 0 120 120" aria-hidden>
              <defs>
                <linearGradient id="swBust" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#e2e8f0" />
                  <stop offset="1" stopColor="#94a3b8" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="46" r="22" fill="url(#swBust)" />
              <path d="M22 114 C22 84 42 76 60 76 C78 76 98 84 98 114 Z" fill="url(#swBust)" />
              <path d="M52 78 L60 96 L68 78 Z" fill="#0b1220" />
            </svg>
            <span className="sw-ring" />
          </div>
          <div className="sw-connecting">已加入 · 等待开场</div>
        </div>
      </div>

      <div className="sw-core">
        <div className="sw-title">用一句话说说你对 AI 的认知</div>
        <div className="sw-sub">它会匿名滚动在大屏上，和大家一起流动。</div>

        <div className="sw-thought-box">
          <textarea
            value={text}
            maxLength={60}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：AI 是助手，也是一面镜子。"
            style={{ width: '100%', minHeight: 90, boxSizing: 'border-box' }}
          />
          <button disabled={busy || !text.trim()} onClick={send}>
            {busy ? '发送中…' : '发到大屏'}
          </button>
          {sent > 0 && <p className="sw-sent">已发送 {sent} 条，大屏上能看到 ✨</p>}
          {err && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</p>}
        </div>

        <div className="sw-fine" style={{ marginTop: 14 }}>一会儿还会请你用一段真实经历，看看你的 AI 标签是什么。</div>
      </div>

      <div className="sw-foot">
        <span className="sw-dot" />
        <span>正在为你准备…　等待教师开启</span>
      </div>
    </div>
  );
}
