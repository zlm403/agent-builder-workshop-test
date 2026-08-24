'use client';
// =========================================================
// A2 快速入门网站 · 大屏组件
// a2:hook 钩子 → a2:s1..s11 阶段（教师控制）→ 作品墙
// 图屏（media=image）只显示图，视频屏（media=video）只显示视频，其余显示标题+问题+任务
// =========================================================
import { useEffect, useState } from 'react';
import { A2_STAGES } from '@/features/siteEntry/config';
import ContentSlot from './ContentSlot';
import { usePageOverrides, pageText } from '@/lib/usePageText';
import { withBasePath } from '@/lib/basePath';

interface A2Item {
  order: number;
  title: string;
  siteCode: string;
  team: { id: string; label: string; icon: string; duty: string }[];
}

interface A2Data {
  total: number;
  submitted: number;
  items: A2Item[];
}

export default function SiteEntryScreen({
  sessionId,
  subState,
}: {
  sessionId: string;
  subState: string | null;
}) {
  const [data, setData] = useState<A2Data | null>(null);
  const ov = usePageOverrides(subState);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/site-entry/analytics?sessionId=${sessionId}`);
        if (!closed) setData(await r.json());
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 钩子开场（a2:hook）已改为内容页（大屏走 ContentPage），此处不再渲染
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^a2:(s\d+)$/);
    return m ? A2_STAGES.findIndex((s) => s.key === m[1]) : -1;
  })();
  const launched = String(subState ?? '') === 'a2:wall';

  const tStageTitle = stageIdx >= 0 ? pageText(ov, 'screenTitle', A2_STAGES[stageIdx].screenTitle) : null;
  const tStageQuestion = stageIdx >= 0 ? pageText(ov, 'screenQuestion', A2_STAGES[stageIdx].screenQuestion) : null;
  const tWallTitle = pageText(ov, 'screenTitle', '全班作品墙');

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 0' }}>
      <ContentSlot slot="a2_top" />

      {/* 当前阶段内容（上下左右居中，只显示内容，无框架） */}
      {stageIdx >= 0 && !launched && (() => {
        const st = A2_STAGES[stageIdx];
        if (st.media === 'image') {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              {st.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBasePath(st.mediaUrl)} alt={st.name} style={{ maxWidth: 'min(1500px, 96vw)', maxHeight: '82vh', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 18 }}>图片位（等张老师给图）</div>
              )}
              <ContentSlot slot={`a2_${A2_STAGES[stageIdx].key}_after`} />
            </div>
          );
        }
        if (st.media === 'video') {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ContentSlot slot={`a2_${A2_STAGES[stageIdx].key}_after`} />
            </div>
          );
        }
        if (st.media === 'embed' && st.mediaUrl) {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
              <iframe src={withBasePath(st.mediaUrl)} title={st.name} style={{ width: 'min(1700px, 100%)', height: 'calc(100vh - 80px)', minHeight: '60vh', border: 'none', background: '#070b16', display: 'block', flex: '0 0 auto' }} />
            </div>
          );
        }
        return (
          <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
            {tStageTitle !== null && <div style={{ fontSize: 'clamp(26px,3.4vw,46px)', fontWeight: 900, maxWidth: 1100, lineHeight: 1.5, whiteSpace: 'pre-line', background: 'linear-gradient(180deg,#f8fafc,#38bdf8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {tStageTitle}
            </div>}
            {tStageQuestion !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,30px)', color: '#fde047', fontWeight: 700, maxWidth: 1000, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {tStageQuestion}
            </div>}
            <ContentSlot slot={`a2_${A2_STAGES[stageIdx].key}_after`} />
          </div>
        );
      })()}

      {/* 作品墙（S9 风格：卡片逐个"降落"上墙，显示真实作品缩略图 + 作品名 + AI 团队） */}
      {launched && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          <ContentSlot slot="a2_wall_after" style={{ marginBottom: 12 }} />
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            {tWallTitle !== null && <div style={{ fontSize: 'clamp(28px,3vw,46px)', fontWeight: 800, letterSpacing: 4, background: 'linear-gradient(180deg,#ffffff,#dfe9ff 55%,#ffe6a8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {tWallTitle}
            </div>}
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>每一件作品，背后都站着一支 AI 团队 · {data?.submitted ?? 0} 人已提交</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18, alignContent: 'start', paddingBottom: 12 }}>
            {(data?.items ?? []).map((it, i) => (
              <div key={i} style={{
                position: 'relative', borderRadius: 22, overflow: 'hidden',
                background: 'linear-gradient(180deg, rgba(22,38,72,.55), rgba(12,22,44,.5))',
                border: '1px solid rgba(160,190,255,.22)',
                boxShadow: '0 0 30px rgba(80,120,220,.16)',
                opacity: 0, transform: 'translateY(40px) scale(.92)',
                animation: `a2land .7s cubic-bezier(.22,1,.36,1) forwards`,
                animationDelay: `${Math.min(i * 0.13, 1.5)}s`,
              }}>
                <div style={{
                  position: 'relative', height: 200, background: 'linear-gradient(135deg, rgba(110,150,255,.18), rgba(150,110,230,.14))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(160,190,255,.18)',
                }}>
                  <iframe srcDoc={it.siteCode} title={it.title} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
                </div>
                <div style={{ padding: '12px 16px 4px', fontSize: 18, fontWeight: 800, letterSpacing: .5 }}>{it.title}</div>
                <div style={{ padding: '8px 16px 14px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: 1, marginBottom: 8 }}>他的 AI 团队</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(it.team ?? []).slice(0, 6).map((m) => (
                      <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d8e4ff', fontWeight: 600 }}>
                        <span style={{
                          width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'linear-gradient(135deg, rgba(120,160,255,.3), rgba(150,110,230,.25))',
                          border: '1px solid rgba(160,190,255,.4)', fontSize: 15,
                        }}>{m.icon}</span>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {(data?.items ?? []).length === 0 && (
              <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 16, textAlign: 'center', padding: '8vh 0' }}>
                还没有作品飞上来，等同学们提交… ✨
              </div>
            )}
          </div>
          {(data?.items ?? []).length > 0 && (
            <div style={{ textAlign: 'center', fontSize: 17, color: '#cfe0ff', paddingBottom: 6 }}>
              你看，他们不是一个人做完的 —— 是让一队 <b style={{ color: '#ffe6a8' }}>AI</b>，各司其职，把活干完的。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
