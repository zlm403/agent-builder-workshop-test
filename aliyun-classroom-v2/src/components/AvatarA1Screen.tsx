'use client';
// =========================================================
// A1 数字分身 · 大屏组件
// avatar:hook 钩子开场 → avatar:1..6 六格逐步点亮（顶目标横幅常驻）→ avatar:wall 作品墙
// =========================================================
import { useEffect, useState } from 'react';
import { A1_STAGES, A1_HOOK } from '@/features/avatarLesson/config';
import CogCompare from './CogCompare';
import MediaPlayer from './MediaPlayer';
import ContentSlot from './ContentSlot';
import { usePageOverrides, pageText, useCurrentPageId } from '@/lib/usePageText';

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
  const pageId = useCurrentPageId(subState);

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

  // 钩子开场（只显示一张孙悟空分身图，无文字）
  if (String(subState ?? '') === 'avatar:hook') {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2vw' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={A1_HOOK.image} alt={A1_HOOK.alt} style={{ maxWidth: 'min(1500px, 96vw)', maxHeight: '90vh', objectFit: 'contain' }} />
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

  const tStageTitle = stageIdx >= 0 ? pageText(ov, 'screenTitle', A1_STAGES[stageIdx].screenTitle) : null;
  const tStageQuestion = stageIdx >= 0 ? pageText(ov, 'screenQuestion', A1_STAGES[stageIdx].screenQuestion) : null;
  const tWallTitle = pageText(ov, 'screenTitle', '全班数字分身 · 朋友圈墙');

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 0' }}>
      <ContentSlot slot="a1_top" />

      {/* 当前环节内容（上下左右居中） */}
      {stageIdx >= 0 && !launched && (() => {
        const st = A1_STAGES[stageIdx];
        // 图屏：只显示图，无文字
        if (st.media === 'image') {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {st.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={st.mediaUrl} alt={st.name} style={{ maxWidth: 'min(1500px, 96vw)', maxHeight: '88vh', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 18 }}>图片位（等张老师给图）</div>
              )}
            </div>
          );
        }
        // 视频屏：只显示视频，无文字（教师自己插视频到内容块）
        if (st.media === 'video') {
          return (
            <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pageId && <ContentSlot slot={`page:${pageId}`} />}
            </div>
          );
        }
        // 普通文字屏
        return (
        <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          {tStageTitle !== null && <div style={{ fontSize: 'clamp(26px,3.4vw,46px)', fontWeight: 900, maxWidth: 1100, lineHeight: 1.5, whiteSpace: 'pre-line', background: 'linear-gradient(180deg,#f8fafc,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {tStageTitle}
          </div>}
          {tStageQuestion !== null && <div style={{ fontSize: 'clamp(18px,2.2vw,30px)', color: '#fde047', fontWeight: 700, maxWidth: 1000, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {tStageQuestion}
          </div>}
          {/* 该环节页的内容块：教师可在页面序列里给本页加图/视频/链接等 */}
          {pageId && <ContentSlot slot={`page:${pageId}`} />}
          {/* 内容槽：教师可在此环节放额外文案/示例/图片/视频 */}
          <ContentSlot slot={`a1_${A1_STAGES[stageIdx].key}_after`} />
        </div>
        );
      })()}

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
