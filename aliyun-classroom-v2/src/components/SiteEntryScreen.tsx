'use client';
// =========================================================
// A2 快速入门网站 · 大屏组件
// a2:hook 钩子 → a2:s1..s11 阶段（教师控制）→ 作品墙
// 图屏（media=image）只显示图，视频屏（media=video）只显示视频，其余显示标题+问题+任务
// =========================================================
import { useEffect, useState } from 'react';
import { A2_STAGES, A2_HOOK } from '@/features/siteEntry/config';
import ContentSlot from './ContentSlot';
import { usePageOverrides, pageText } from '@/lib/usePageText';

interface A2Data {
  total: number;
  submitted: number;
  cols: string[];
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

  // 钩子开场
  if (String(subState ?? '') === 'a2:hook') {
    const tEyebrow = pageText(ov, 'eyebrow', A2_HOOK.eyebrow);
    const tTitle = pageText(ov, 'title', A2_HOOK.title);
    const tBody1 = pageText(ov, 'body1', A2_HOOK.body1);
    const tBody2 = pageText(ov, 'body2', A2_HOOK.body2);
    const tBridge = pageText(ov, 'bridge', A2_HOOK.bridge);
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
        <ContentSlot slot="a2_top" />
        {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
        {tTitle !== null && <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#38bdf8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>{tTitle}</div>}
        {tBody1 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 900 }}>{tBody1}</div>}
        {tBody2 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#fde047', fontWeight: 700, lineHeight: 1.7, maxWidth: 900 }}>{tBody2}</div>}
        {tBridge !== null && <div style={{ fontSize: 'clamp(16px,1.9vw,24px)', color: '#7dd3fc', lineHeight: 1.7, maxWidth: 900, marginTop: 8 }}>{tBridge}</div>}
        <ContentSlot slot="a2_hook_after" />
      </div>
    );
  }

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
            <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {st.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={st.mediaUrl} alt={st.name} style={{ maxWidth: 'min(1500px, 96vw)', maxHeight: '90vh', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 18 }}>图片位（等张老师给图）</div>
              )}
            </div>
          );
        }
        if (st.media === 'video') {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ContentSlot slot={`page:${st.key}`} />
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

      {/* 作品墙 */}
      {launched && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          <ContentSlot slot="a2_wall_after" style={{ marginBottom: 12 }} />
          {tWallTitle !== null && <div style={{ fontSize: 18, fontWeight: 800, color: '#86efac', marginBottom: 14 }}>
            {tWallTitle} ({data?.submitted ?? 0} 人已提交)
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {(data?.cols ?? []).map((c, i) => (
              <div key={i} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                <iframe srcDoc={c} title={`作品 ${i + 1}`} style={{ width: '100%', height: 420, border: 'none', background: '#fff', borderRadius: 8 }} />
              </div>
            ))}
            {(data?.cols ?? []).length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 15 }}>还没有人提交，等同学们的作品上墙…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
