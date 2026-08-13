'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  COMPANIES,
  SCREEN_SLIDES,
  FUNNEL_STAGES,
  type CompanyTypeKey,
} from '@/lib/finaleConfig';
import ContentSlot from './ContentSlot';

/* ---------- CSS Variables ---------- */
const cssVars = {
  bg: '#0b1120',
  panel: '#111a2e',
  panel2: '#16213a',
  line: '#26324d',
  txt: '#e2e8f0',
  sub: '#94a3b8',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#38bdf8',
  orange: '#fb923c',
  purple: '#a78bfa',
};

/* ========== 主组件 ========== */
export default function ScreenFinale() {
  const [mode, setMode] = useState<'brief' | 'dash'>('brief');
  const [slideIdx, setSlideIdx] = useState(0);
  const [animOrg, setAnimOrg] = useState(false);

  // 作战态数据（demo 模式，实际应从 API 获取）
  const [totalStudents] = useState(42);
  const [typeCount] = useState<Record<string, number>>({ study: 18, shop: 14, fun: 10 });
  const [funnel] = useState<Record<string, number>>({
    chosen: 40,
    team: 35,
    dup: 28,
    recep: 20,
    open: 12,
  });
  const [released, setReleased] = useState({ dup: false, open: false });
  const [leaderboard] = useState([
    { bossName: '张三', companyName: 'AI好物店', revenue: 280 },
    { bossName: '李四', companyName: 'AI学习中心', revenue: 199 },
    { bossName: '王五', companyName: 'AI娱乐社', revenue: 99 },
    { bossName: '赵六', companyName: 'AI好物店', revenue: 80 },
    { bossName: '钱七', companyName: 'AI学习中心', revenue: 199 },
  ]);

  // 讲解态幻灯片切换
  const nextSlide = useCallback(() => {
    setSlideIdx((i) => (i + 1) % SCREEN_SLIDES.length);
  }, []);
  const prevSlide = useCallback(() => {
    setSlideIdx((i) => (i - 1 + SCREEN_SLIDES.length) % SCREEN_SLIDES.length);
  }, []);

  // 组织图动画
  useEffect(() => {
    if (mode === 'brief') {
      setAnimOrg(true);
      const t = setTimeout(() => setAnimOrg(false), 600);
      return () => clearTimeout(t);
    }
  }, [slideIdx, mode]);

  // 阶段释放
  const releaseStage = useCallback((key: string) => {
    if (key === 'dup') setReleased((r) => ({ ...r, dup: true }));
    if (key === 'open') setReleased((r) => ({ ...r, open: true }));
  }, []);

  /* ========== 渲染 ========== */
  return (
    <div style={{
      fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
      background: `radial-gradient(1400px 700px at 50% -10%,#13203a,#0b1120 60%)`,
      color: cssVars.txt,
      minHeight: '100vh',
      padding: 24,
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, flexWrap: 'wrap' as never, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.5 }}>
            <span style={{ color: cssVars.yellow }}>一人公司</span> · 大屏
          </div>
          <div style={{
            fontSize: 12, color: cssVars.sub, border: `1px solid ${cssVars.line}`,
            padding: '2px 10px', borderRadius: 20,
          }}>
            <span>一人公司</span>
          </div>
          <div style={{
            fontSize: 12, color: cssVars.blue, border: `1px solid rgba(56,189,248,.4)`,
            padding: '2px 10px', borderRadius: 20,
          }}>
            {mode === 'brief' ? '讲解态' : '作战态'}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, background: cssVars.panel, borderRadius: 12, padding: 3 }}>
          <button onClick={() => setMode('brief')} style={modeBtnStyle(mode === 'brief')}>讲解</button>
          <button onClick={() => setMode('dash')} style={modeBtnStyle(mode === 'dash')}>作战</button>
        </div>
      </div>

      <ContentSlot slot="finale_top" />

      {/* ====== 讲解态 ====== */}
      {mode === 'brief' && (
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Slide content */}
          <div style={{
            background: `linear-gradient(180deg,${cssVars.panel},${cssVars.panel2})`,
            border: `1px solid ${cssVars.line}`, borderRadius: 20,
            padding: '36px 32px', minHeight: 420,
          }}>
            <div style={{ color: cssVars.yellow, fontWeight: 800, letterSpacing: 1.5, marginBottom: 14, fontSize: 15 }}>
              {SCREEN_SLIDES[slideIdx].no}
            </div>
            <h2 style={{ fontSize: 32, marginBottom: 16 }}>{SCREEN_SLIDES[slideIdx].h}</h2>
            <p style={{ color: cssVars.sub, fontSize: 17, lineHeight: 1.7, maxWidth: 720 }}
              dangerouslySetInnerHTML={{ __html: SCREEN_SLIDES[slideIdx].p }}
            />

            {/* Org chart */}
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {SCREEN_SLIDES[slideIdx].org.map((n, i) => (
                  <div key={i} className={`org-node ${n.cls}`}
                    style={{
                      width: 72, height: 72, borderRadius: 18,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4,
                      background: n.cls === 'warn'
                        ? 'rgba(251,146,60,.12)'
                        : n.cls === 'recep'
                          ? 'rgba(234,179,8,.12)'
                          : 'rgba(34,197,94,.08)',
                      border: n.cls === 'warn'
                        ? `1px solid ${cssVars.orange}`
                        : n.cls === 'recep'
                          ? `1px solid ${cssVars.yellow}`
                          : `1px solid ${cssVars.green}`,
                      opacity: animOrg ? 0 : 1,
                      transform: animOrg ? 'scale(.7)' : 'scale(1)',
                      transition: '.35s ease-out',
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{n.ico}</div>
                    <div style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.25, maxWidth: 64 }}>{n.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Slide nav */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
            <button onClick={prevSlide} style={navBtn}>←</button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {SCREEN_SLIDES.map((_, i) => (
                <div key={i} style={{
                  width: i === slideIdx ? 22 : 8, height: 8, borderRadius: 999,
                  background: i === slideIdx ? cssVars.green : cssVars.line,
                  transition: '.25s',
                }} />
              ))}
            </div>
            <button onClick={nextSlide} style={navBtn}>→</button>
          </div>
        </div>
      )}

      {/* ====== 作战态 ====== */}
      {mode === 'dash' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20, maxWidth: 1200 }}>
          {/* 公司分布 */}
          <div style={{
            background: `linear-gradient(180deg,${cssVars.panel},${cssVars.panel2})`,
            border: `1px solid ${cssVars.line}`, borderRadius: 18, padding: 22,
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>公司类型分布</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(Object.entries(COMPANIES) as [CompanyTypeKey, typeof COMPANIES[CompanyTypeKey]][]).map(([k, v]) => {
                const cnt = typeCount[k] || 0;
                const pct = totalStudents > 0 ? Math.round((cnt / totalStudents) * 100) : 0;
                return (
                  <div key={k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span>{v.icon} {v.name}</span>
                      <span style={{ color: cssVars.sub }}>{cnt}人（{pct}%）</span>
                    </div>
                    <div style={{ height: 8, background: cssVars.panel2, borderRadius: 8, overflow: 'hidden' }}>
                      <i style={{ display: 'block', height: '100%', width: `${pct}%`, background: k === 'study' ? cssVars.blue : k === 'shop' ? cssVars.purple : cssVars.orange, transition: '.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 全班进度漏斗 */}
          <div style={{
            background: `linear-gradient(180deg,${cssVars.panel},${cssVars.panel2})`,
            border: `1px solid ${cssVars.line}`, borderRadius: 18, padding: 22,
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>全班进度</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FUNNEL_STAGES.map((st, i) => {
                const cnt = funnel[st.key] || 0;
                const isLocked = st.key === 'dup' && !released.dup;
                const isOpenLocked = st.key === 'open' && !released.open;
                const locked = isLocked || isOpenLocked;
                return (
                  <div key={st.key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: locked ? 0.45 : 1, transition: '.25s',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800,
                      background: locked ? cssVars.panel2 : cssVars.green,
                      color: locked ? cssVars.sub : '#06210f',
                    }}>
                      {locked ? '🔒' : i + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 14 }}>{st.label}</div>
                    <div style={{
                      minWidth: 48, textAlign: 'right', fontWeight: 800,
                      color: locked ? cssVars.sub : cssVars.txt,
                    }}>{cnt} 人</div>
                    {isLocked && (
                      <button onClick={() => releaseStage('dup')} style={releaseBtn}>
                        释放
                      </button>
                    )}
                    {isOpenLocked && released.dup && (
                      <button onClick={() => releaseStage('open')} style={releaseBtn}>
                        释放
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 营收排行榜 */}
          <div style={{
            background: `linear-gradient(180deg,${cssVars.panel},${cssVars.panel2})`,
            border: `1px solid ${cssVars.line}`, borderRadius: 18, padding: 22,
            gridColumn: '1 / -1',
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>营收排行榜</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
              {leaderboard.map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900,
                    background: i === 0 ? cssVars.yellow : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : cssVars.panel,
                    color: i <= 2 ? '#000' : cssVars.sub,
                  }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{row.bossName}</div>
                    <div style={{ color: cssVars.sub, fontSize: 13 }}>{row.companyName}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: cssVars.green }}>
                    ¥{row.revenue}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ContentSlot slot="finale_sale_after" />
    </div>
  );
}

/* ========== 共享样式 ========== */
const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? cssVars.green : 'transparent',
  color: active ? '#06210f' : cssVars.sub,
  border: 'none',
  borderRadius: 9,
  padding: '8px 16px',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
});

const navBtn: React.CSSProperties = {
  background: cssVars.panel,
  border: `1px solid ${cssVars.line}`,
  color: cssVars.txt,
  borderRadius: 10,
  width: 40, height: 40,
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 800,
};

const releaseBtn: React.CSSProperties = {
  background: cssVars.yellow,
  color: '#3a2c00',
  border: 'none',
  borderRadius: 8,
  padding: '6px 14px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};
