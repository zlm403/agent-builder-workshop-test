'use client';
// =========================================================
// 做事认知对比图 · 大屏组件（旧认知 → 新认知，三行）
// A1 收官时教师切换到 avatar:cog 显示
// =========================================================
import { A1_COG_COMPARE } from '@/features/avatarLesson/config';

export default function CogCompare() {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 5vw' }}>
      <div style={{ fontSize: 'clamp(26px,3.4vw,44px)', fontWeight: 900, textAlign: 'center', background: 'linear-gradient(180deg,#f8fafc,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        {A1_COG_COMPARE.title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 'min(1300px, 94vw)' }}>
        {A1_COG_COMPARE.rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 0.55fr 1fr', gap: 14, alignItems: 'center' }}>
            {/* 旧认知 */}
            <div style={{ background: 'rgba(100,116,139,0.16)', border: '1px solid rgba(148,163,184,0.4)', borderRadius: 16, padding: '18px 24px' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>以前 · {row.from}</div>
              <div style={{ fontSize: 'clamp(15px,1.8vw,24px)', color: '#cbd5e1', lineHeight: 1.5 }}>{row.old}</div>
            </div>
            {/* 箭头 */}
            <div style={{ textAlign: 'center', fontSize: 'clamp(22px,2.6vw,34px)', color: '#fde047' }}>→</div>
            {/* 新认知 */}
            <div style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(167,139,250,0.55)', borderRadius: 16, padding: '18px 24px', boxShadow: '0 0 24px rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>现在 · {row.to}</div>
              <div style={{ fontSize: 'clamp(15px,1.8vw,24px)', color: '#f8fafc', fontWeight: 600, lineHeight: 1.5 }}>{row.now}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#fde047', fontWeight: 800, textAlign: 'center', marginTop: 8, maxWidth: 1100 }}>
        {A1_COG_COMPARE.punchline}
      </div>
    </div>
  );
}
