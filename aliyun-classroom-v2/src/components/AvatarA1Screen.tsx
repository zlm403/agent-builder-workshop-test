'use client';
// =========================================================
// A1 数字分身 · 大屏组件
// avatar:hook 钩子开场 → avatar:1..6 六格逐步点亮（顶目标横幅常驻）→ avatar:wall 作品墙
// =========================================================
import { useEffect, useState } from 'react';
import { A1_STAGES, A1_HOOK, A1_GOAL } from '@/features/avatarLesson/config';
import CogCompare from './CogCompare';
import MediaPlayer from './MediaPlayer';
import ContentSlot from './ContentSlot';
import { usePageOverrides, pageText } from '@/lib/usePageText';

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
  const ov = usePageOverrides(subState);

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

  // 钩子开场
  if (String(subState ?? '') === 'avatar:hook') {
    const tEyebrow = pageText(ov, 'eyebrow', A1_HOOK.eyebrow);
    const tTitle = pageText(ov, 'title', A1_HOOK.title);
    const tBody1 = pageText(ov, 'body1', A1_HOOK.body1);
    const tBody2 = pageText(ov, 'body2', A1_HOOK.body2);
    const tBridge = pageText(ov, 'bridge', A1_HOOK.bridge);
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
        <ContentSlot slot="a1_top" />
        {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
        {tTitle !== null && <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>{tTitle}</div>}
        {tBody1 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 900 }}>{tBody1}</div>}
        {tBody2 !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,28px)', color: '#fde047', fontWeight: 700, lineHeight: 1.7, maxWidth: 900 }}>{tBody2}</div>}
        {tBridge !== null && <div style={{ fontSize: 'clamp(16px,1.9vw,24px)', color: '#93c5fd', lineHeight: 1.7, maxWidth: 900, marginTop: 8 }}>{tBridge}</div>}
        <ContentSlot slot="a1_hook_after" />
      </div>
    );
  }

  // 做事认知对比图（A1 收官）
  if (String(subState ?? '') === 'avatar:cog') {
    return <CogCompare />;
  }

  // 视频插槽（A1 收官 · 教师内容框架）
  if (String(subState ?? '') === 'avatar:video') {
    return <MediaPlayer slot="a1_video_after" title="普通人的例子" />;
  }

  // 当前环节（avatar:cN），未设置则默认 c1
  const stageIdx = (() => {
    const m = String(subState ?? '').match(/^avatar:(c\d+)$/);
    return m ? A1_STAGES.findIndex((s) => s.key === m[1]) : 0;
  })();

  const launched = String(subState ?? '') === 'avatar:wall';

  const tBanner = pageText(ov, 'banner', A1_GOAL.banner);
  const tStageTitle = stageIdx >= 0 ? pageText(ov, 'screenTitle', A1_STAGES[stageIdx].screenTitle) : null;
  const tStageQuestion = stageIdx >= 0 ? pageText(ov, 'screenQuestion', A1_STAGES[stageIdx].screenQuestion) : null;
  const tStageTask = stageIdx >= 0 ? pageText(ov, 'studentTask', A1_STAGES[stageIdx].studentTask) : null;
  const tWallTitle = pageText(ov, 'screenTitle', '全班数字分身 · 朋友圈墙');

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 0' }}>
      <ContentSlot slot="a1_top" />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#c4b5fd' }}>数字分身</div>
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

      {/* 十七环节进度条（任务链 1-12 / 升华链 13-17） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(17, 1fr)', gap: 4 }}>
          {A1_STAGES.map((s, i) => {
            const active = i === stageIdx;
            const done = stageIdx !== -1 && i < stageIdx;
            return (
              <div key={s.key} style={{
                textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: 10,
                border: active ? '1px solid rgba(124,58,237,0.8)' : done ? '1px solid rgba(134,239,172,0.4)' : '1px solid var(--border)',
                background: active ? 'rgba(124,58,237,0.22)' : done ? 'rgba(134,239,172,0.10)' : 'rgba(15,23,42,0.4)',
                color: active ? '#c4b5fd' : done ? '#86efac' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
              }}>
                {i + 1}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ color: '#c4b5fd' }}>● 任务链（1-12 · 造分身）</span>
          <span style={{ color: '#fde047' }}>● 升华链（13-17 · 一支队伍）</span>
        </div>
      </div>

      {/* 当前环节内容 */}
      {stageIdx >= 0 && !launched && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          {tStageTitle !== null && <div style={{ fontSize: 'clamp(26px,3.4vw,46px)', fontWeight: 900, maxWidth: 1100, background: 'linear-gradient(180deg,#f8fafc,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {tStageTitle}
          </div>}
          {tStageQuestion !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,30px)', color: '#fde047', fontWeight: 700, maxWidth: 1000, lineHeight: 1.6 }}>
            {tStageQuestion}
          </div>}
          {tStageTask !== null && <div style={{ fontSize: 'clamp(15px,1.8vw,24px)', color: '#cbd5e1', maxWidth: 900, lineHeight: 1.7 }}>
            {tStageTask}
          </div>}
          {/* 内容槽：教师可在此环节放额外文案/示例/图片/视频 */}
          <ContentSlot slot={`a1_${A1_STAGES[stageIdx].key}_after`} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            环节 {stageIdx + 1} / 17 · {A1_STAGES[stageIdx].output}
            {stageIdx < 16 && <span style={{ color: '#fde047' }}> · 教师讲完可进入下一环节</span>}
          </div>
        </div>
      )}

      {/* 朋友圈墙 */}
      {launched && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          <ContentSlot slot="a1_wall_after" style={{ marginBottom: 12 }} />
          {tWallTitle !== null && <div style={{ fontSize: 18, fontWeight: 800, color: '#86efac', marginBottom: 14 }}>
            {tWallTitle} ({data?.finished ?? 0} 人完成)
          </div>}
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
      )}
    </div>
  );
}
