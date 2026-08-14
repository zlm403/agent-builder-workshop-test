'use client';
// =========================================================
// P2 快速入门网站 · 大屏组件（六座山 · 十二阶段）
// p2:hook 钩子 → p2:s1..s12 阶段（教师控制推进）→ p2:wall 作品墙
// 每阶段显示：大屏标题 + 大屏问题 + 阶段进度 + 内容槽（教师可配）
// =========================================================
import { useEffect, useState } from 'react';
import { P2_STAGES, P2_HOOK, P2_GOAL } from '@/features/siteEntry/config';
import ContentSlot from './ContentSlot';
import { usePageOverrides, pageText } from '@/lib/usePageText';

interface P2Data {
  total: number;
  started: number;
  byStep: number[];
  finished: number;
  cols: string[];
  rows: { anonymousId: string; nickname: string | null; step: number; summary: string }[];
}

export default function SiteEntryScreen({
  sessionId,
  subState,
}: {
  sessionId: string;
  subState: string | null;
}) {
  const [data, setData] = useState<P2Data | null>(null);
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
  if (String(subState ?? '') === 'p2:hook') {
    const tEyebrow = pageText(ov, 'eyebrow', P2_HOOK.eyebrow);
    const tTitle = pageText(ov, 'title', P2_HOOK.title);
    const tBody1 = pageText(ov, 'body1', P2_HOOK.body1);
    const tBody2 = pageText(ov, 'body2', P2_HOOK.body2);
    const tBridge = pageText(ov, 'bridge', P2_HOOK.bridge);
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
        <ContentSlot slot="p2_top" />
        {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
        {tTitle !== null && <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#38bdf8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>{tTitle}</div>}
        {tBody1 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 900 }}>{tBody1}</div>}
        {tBody2 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#fde047', fontWeight: 700, lineHeight: 1.7, maxWidth: 900 }}>{tBody2}</div>}
        {tBridge !== null && <div style={{ fontSize: 'clamp(16px,1.9vw,24px)', color: '#7dd3fc', lineHeight: 1.7, maxWidth: 900, marginTop: 8 }}>{tBridge}</div>}
        <ContentSlot slot="p2_hook_after" />
      </div>
    );
  }

  // 当前阶段（p2:sN）
  const stageMatch = String(subState ?? '').match(/^p2:(s\d+)$/);
  const stageIdx = stageMatch ? P2_STAGES.findIndex((s) => s.key === stageMatch[1]) : -1;
  const launched = String(subState ?? '') === 'p2:wall';

  const tBanner = pageText(ov, 'banner', P2_GOAL.banner);
  const tStageTitle = stageIdx >= 0 ? pageText(ov, 'screenTitle', P2_STAGES[stageIdx].screenTitle) : null;
  const tStageQuestion = stageIdx >= 0 ? pageText(ov, 'screenQuestion', P2_STAGES[stageIdx].screenQuestion) : null;
  const tStageTask = stageIdx >= 0 ? pageText(ov, 'studentTask', P2_STAGES[stageIdx].studentTask) : null;
  const tWallTitle = pageText(ov, 'screenTitle', '全班入门网站 · 作品墙');

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 0' }}>
      <ContentSlot slot="p2_top" />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8' }}>快速入门网站</div>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>已参与 {data?.started ?? 0}/{data?.total ?? 0}</div>
      </div>

      {/* 目标横幅 · 常驻 */}
      {tBanner !== null && (
      <div style={{
        border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.10)', borderRadius: 14,
        padding: '12px 20px', fontSize: 'clamp(15px,1.7vw,22px)', color: '#fde047', fontWeight: 700, textAlign: 'center',
      }}>
        {tBanner}
      </div>
      )}

      {/* 十二阶段进度条 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
        {P2_STAGES.map((s, i) => {
          const active = i === stageIdx;
          const done = stageIdx !== -1 && i < stageIdx;
          return (
            <div key={s.key} style={{
              textAlign: 'center', padding: '8px 4px', borderRadius: 8, fontSize: 11,
              border: active ? '1px solid rgba(56,189,248,0.8)' : done ? '1px solid rgba(134,239,172,0.4)' : '1px solid var(--border)',
              background: active ? 'rgba(56,189,248,0.20)' : done ? 'rgba(134,239,172,0.10)' : 'rgba(15,23,42,0.4)',
              color: active ? '#7dd3fc' : done ? '#86efac' : 'var(--muted)',
              fontWeight: active ? 700 : 400,
            }}>
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* 当前阶段内容 */}
      {stageIdx >= 0 && !launched && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
          {tStageTitle !== null && <div style={{ fontSize: 'clamp(26px,3.4vw,46px)', fontWeight: 900, maxWidth: 1100, background: 'linear-gradient(180deg,#f8fafc,#38bdf8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {tStageTitle}
          </div>}
          {tStageQuestion !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,30px)', color: '#fde047', fontWeight: 700, maxWidth: 1000, lineHeight: 1.6 }}>
            {tStageQuestion}
          </div>}
          {tStageTask !== null && <div style={{ fontSize: 'clamp(15px,1.8vw,24px)', color: '#cbd5e1', maxWidth: 900, lineHeight: 1.7 }}>
            {tStageTask}
          </div>}
          {/* 内容槽：教师可在此阶段放额外文案/示例/图片/视频 */}
          <ContentSlot slot={`p2_${P2_STAGES[stageIdx].key}_after`} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            第 {stageIdx + 1} / 12 阶段 · {P2_STAGES[stageIdx].output}
            {stageIdx < 11 && <span style={{ color: '#fde047' }}> · 教师讲完可进入下一阶段</span>}
          </div>
        </div>
      )}

      {/* 作品墙 */}
      {launched && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          <ContentSlot slot="p2_wall_after" style={{ marginBottom: 12 }} />
          {tWallTitle !== null && <div style={{ fontSize: 18, fontWeight: 800, color: '#86efac', marginBottom: 14 }}>
            {tWallTitle} ({data?.finished ?? 0} 人已提交)
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {(data?.cols ?? []).map((c, i) => (
              <div key={i} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
                {c}
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
