'use client';

import { useEffect, useState, useCallback } from 'react';
import { CLOSING_BEATS } from '@/lib/closingConfig';
import ClosingQATeacher from '@/components/ClosingQATeacher';

export default function TeacherClosing({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [beatIdx, setBeatIdx] = useState(0);
  const [enroll, setEnroll] = useState(0);
  const [enrollInput, setEnrollInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'cue' | 'qa'>('cue');

  const loadEnroll = useCallback(async () => {
    try {
      const r = await fetch(`/api/closing/enroll?sessionId=${sessionId}`);
      const d = await r.json();
      if (typeof d.count === 'number') setEnroll(d.count);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    loadEnroll();
    const t = setInterval(loadEnroll, 3000);
    return () => clearInterval(t);
  }, [loadEnroll]);

  // 进入 / 退出收官：广播给「常规课堂」大屏与学生页（不再开独立新窗口）
  useEffect(() => {
    const post = (body: Record<string, unknown>) =>
      fetch('/api/closing/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...body }),
      }).catch(() => {});
    post({ active: true });
    return () => {
      post({ active: false });
    };
  }, [sessionId]);

  // 节拍切换：同步给大屏
  useEffect(() => {
    fetch('/api/closing/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, beatIdx }),
    }).catch(() => {});
  }, [sessionId, beatIdx]);

  const beat = CLOSING_BEATS[beatIdx];

  async function submitEnroll() {
    setBusy(true);
    try {
      const r = await fetch('/api/closing/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, count: Number(enrollInput || 0) }),
      });
      const d = await r.json();
      if (d.count != null) {
        setEnroll(d.count);
        setToast(`已提交报名人数：${d.count} 人（大屏实时显示）`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <div className="finale-tc-head">
        <div>
          <div className="finale-kicker">讲师提词台</div>
          <h2>收官 · 导演台</h2>
        </div>
        <button className="secondary" onClick={onClose}>返回常规课堂 →</button>
      </div>

      <div className="card">
        {/* 页签：讲师提词 / 集中答疑 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={tab === 'cue' ? 'primary' : 'secondary'} style={{ fontSize: 13 }} onClick={() => setTab('cue')}>讲师提词</button>
          <button className={tab === 'qa' ? 'primary' : 'secondary'} style={{ fontSize: 13 }} onClick={() => setTab('qa')}>集中答疑</button>
        </div>

        {tab === 'cue' ? (
          <>
            <div className="tc-state">
              <span className="pill blue">已报名 {enroll} 人</span>
              <span className="pill gray">{beat.time}</span>
              <span className="pill yellow">{beat.h.replace(/：.*/, '')}</span>
            </div>

            {/* 节拍导航（提词用，仅本端） */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as never, marginTop: 14 }}>
              {CLOSING_BEATS.map((b, i) => (
                <button
                  key={b.key}
                  onClick={() => setBeatIdx(i)}
                  className={i === beatIdx ? 'primary' : 'secondary'}
                  style={{ fontSize: 13 }}
                >
                  {b.time} {b.h.replace(/：.*/, '')}
                </button>
              ))}
            </div>

            {/* 讲师逐字稿 */}
            <div style={{
              marginTop: 16, background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.3)',
              borderRadius: 12, padding: '16px 18px', fontSize: 16, lineHeight: 1.8, color: '#e2e8f0',
            }}>
              <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 800, marginBottom: 8 }}>讲师提词（照此讲）</div>
              {beat.cue}
            </div>

            {/* 报名人数提交 */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as never }}>
              <span style={{ fontSize: 14 }}>提交报名人数：</span>
              <input
                type="number"
                min={0}
                value={enrollInput}
                onChange={(e) => setEnrollInput(e.target.value)}
                placeholder="0"
                style={{ width: 110, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 15 }}
              />
              <button className="primary" disabled={busy} onClick={submitEnroll}>提交</button>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>提交后大屏右上角实时更新</span>
            </div>

            {toast ? <p className="finale-warn" style={{ marginTop: 12 }}>{toast}</p> : null}
          </>
        ) : (
          <ClosingQATeacher sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}
