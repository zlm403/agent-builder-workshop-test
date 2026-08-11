'use client';
// =========================================================
// A1 数字分身 · 大屏组件
// 六格（六步）逐步点亮 + 全班数字分身朋友圈墙
// =========================================================
import { useEffect, useState } from 'react';
import { A1_STEPS, A1_BIGSCREEN_HINTS } from '@/features/avatarLesson/config';

interface A1Data {
  total: number;
  started: number;
  byStep: number[];
  finished: number;
  cols: string[];
  rows: { anonymousId: string; nickname: string | null; step: number; summary: string }[];
}

export default function AvatarA1Screen({
  sessionId,
  subState,
}: {
  sessionId: string;
  subState: string | null;
}) {
  const [data, setData] = useState<A1Data | null>(null);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/avatar/a1/analytics?sessionId=${sessionId}`);
        if (!closed) setData(await r.json());
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 教师点亮到第几步（avatar:N），未设置则默认第 1 步点亮
  const active = (() => {
    const m = String(subState ?? '').match(/^avatar:(\d+)$/);
    return m ? Math.min(6, Math.max(1, parseInt(m[1], 10))) : 1;
  })();

  const launched = String(subState ?? '') === 'avatar:wall';

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#c4b5fd' }}>A1 · 数字分身</div>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>手机端：一个对话框不停地问、不停地说 · 已参与 {data?.started ?? 0}/{data?.total ?? 0}</div>
      </div>

      {/* 六格流程图 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {A1_STEPS.map((s, i) => {
          const n = i + 1;
          const lit = n <= active || launched;
          return (
            <div
              key={s.key}
              style={{
                borderRadius: 14, padding: '14px 12px', textAlign: 'center',
                border: lit ? '1px solid rgba(124,58,237,0.7)' : '1px solid var(--border)',
                background: lit ? 'rgba(124,58,237,0.16)' : 'rgba(15,23,42,0.4)',
                boxShadow: lit ? '0 0 22px rgba(124,58,237,0.25)' : 'none',
                transition: 'all .4s',
                opacity: lit ? 1 : 0.55,
              }}
            >
              <div style={{ fontSize: 12, color: lit ? '#c4b5fd' : 'var(--muted)', fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 6px', color: lit ? '#fff' : '#9aa4b4' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: lit ? '#cdd5e3' : '#6b7280', lineHeight: 1.4 }}>{A1_BIGSCREEN_HINTS[i]}</div>
              {lit && !launched && (
                <div style={{ marginTop: 8, fontSize: 14 }}>{n === active ? '✨' : '✓'}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 朋友圈墙 */}
      {launched ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#86efac', marginBottom: 14 }}>
            {"全班数字分身 · 朋友圈墙"} ({data?.finished ?? 0} 人完成)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {(data?.cols ?? []).map((c, i) => (
              <div key={i} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
                {c}
              </div>
            ))}
            {(data?.cols ?? []).length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 15 }}>还没有人完成，等同学们的作品上墙…</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 'clamp(22px,3vw,40px)', fontWeight: 800, maxWidth: 1100, textAlign: 'center', background: 'linear-gradient(180deg,#f8fafc,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {A1_STEPS[active - 1]?.title}
          </div>
          <div style={{ fontSize: 16, color: '#93c5fd', maxWidth: 900, textAlign: 'center', lineHeight: 1.6 }}>
            {A1_BIGSCREEN_HINTS[active - 1]}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, color: 'var(--muted)' }}>
            当前补给：已到第 {active} 步 · {data?.byStep?.[active - 1] ?? 0}/{data?.total ?? 0} 人已完成这一步
            {active < 6 && <span style={{ color: '#fde047' }}>教师讲完可点亮下一步</span>}
          </div>
        </div>
      )}
    </div>
  );
}
