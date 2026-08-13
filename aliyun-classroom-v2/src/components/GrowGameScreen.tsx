'use client';
// =========================================================
// P3 数字生命共生缸 · 大屏组件
// p3:hook 钩子 → p3:s1..s10 阶段（教师控制）→ p3:wall 投入后显示共生缸
// 阶段：空世界→特质→设计→生成→投入→观察→修改→二次运行→过程卡→收束
// =========================================================
import { useEffect, useState } from 'react';
import { P3_STAGES, P3_HOOK, P3_GOAL } from '@/features/growGame/config';
import ContentSlot from './ContentSlot';
import Tank from './Tank';
import { usePageOverrides } from '@/lib/usePageText';

export default function GrowGameScreen({
  sessionId,
  subState,
}: {
  sessionId: string;
  subState: string | null;
}) {
  const [ready, setReady] = useState(0);
  const ov = usePageOverrides(subState);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/grow-game/tank?sessionId=${sessionId}`);
        const d = await r.json();
        if (!closed && d.lives) setReady(d.lives.length);
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 钩子开场
  if (String(subState ?? '') === 'p3:hook') {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
        <ContentSlot slot="p3_top" />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fb923c', letterSpacing: '0.12em' }}>{ov.eyebrow ?? P3_HOOK.eyebrow}</div>
        <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#fb923c)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>{ov.title ?? P3_HOOK.title}</div>
        <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 900 }}>{ov.body1 ?? P3_HOOK.body1}</div>
        <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#fde047', fontWeight: 700, lineHeight: 1.7, maxWidth: 900 }}>{ov.body2 ?? P3_HOOK.body2}</div>
        <div style={{ fontSize: 'clamp(16px,1.9vw,24px)', color: '#fdba74', lineHeight: 1.7, maxWidth: 900, marginTop: 8 }}>{ov.bridge ?? P3_HOOK.bridge}</div>
        <ContentSlot slot="p3_hook_after" />
      </div>
    );
  }

  // 当前阶段（p3:sN）
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^p3:(s\d+)$/);
    return m ? P3_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const inTank = String(subState ?? '') === 'p3:wall';

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 0' }}>
      <ContentSlot slot="p3_top" />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fb923c' }}>{ov.screenTitle ?? '数字生命 · 共生缸'}</div>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>已投入 {ready} 个生命</div>
      </div>

      {/* 目标横幅 · 常驻 */}
      <div style={{
        border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.10)', borderRadius: 14,
        padding: '12px 20px', fontSize: 'clamp(15px,1.7vw,22px)', color: '#fde047', fontWeight: 700, textAlign: 'center',
      }}>
        {ov.banner ?? P3_GOAL.banner}
      </div>

      {/* 阶段进度条 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {P3_STAGES.map((s, i) => {
          const active = i === stageIdx;
          const done = stageIdx !== -1 && i < stageIdx;
          return (
            <div key={s.key} style={{
              textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: 10,
              border: active ? '1px solid rgba(251,146,60,0.8)' : done ? '1px solid rgba(134,239,172,0.4)' : '1px solid var(--border)',
              background: active ? 'rgba(251,146,60,0.22)' : done ? 'rgba(134,239,172,0.10)' : 'rgba(15,23,42,0.4)',
              color: active ? '#fdba74' : done ? '#86efac' : 'var(--muted)',
              fontWeight: active ? 700 : 400,
            }}>
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* 共生缸（投入后常驻显示） */}
      {inTank && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <Tank sessionId={sessionId} />
        </div>
      )}

      {/* 当前阶段内容 */}
      {stageIdx >= 0 && !inTank && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(26px,3.4vw,46px)', fontWeight: 900, maxWidth: 1100, background: 'linear-gradient(180deg,#f8fafc,#fb923c)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {ov.screenTitle ?? P3_STAGES[stageIdx].screenTitle}
          </div>
          <div style={{ fontSize: 'clamp(18px,2.2vw,30px)', color: '#fde047', fontWeight: 700, maxWidth: 1000, lineHeight: 1.6 }}>
            {ov.screenQuestion ?? P3_STAGES[stageIdx].screenQuestion}
          </div>
          <div style={{ fontSize: 'clamp(15px,1.8vw,24px)', color: '#cbd5e1', maxWidth: 900, lineHeight: 1.7 }}>
            {ov.studentTask ?? P3_STAGES[stageIdx].studentTask}
          </div>
          <ContentSlot slot={`p3_${P3_STAGES[stageIdx].key}_after`} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            阶段 {stageIdx + 1} / 10 · {P3_STAGES[stageIdx].output}
            {stageIdx < 9 && <span style={{ color: '#fde047' }}> · 教师讲完可进入下一阶段</span>}
          </div>
        </div>
      )}
    </div>
  );
}
