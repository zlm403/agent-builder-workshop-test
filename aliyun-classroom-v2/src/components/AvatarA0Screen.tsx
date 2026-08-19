'use client';
// =========================================================
// A0 新版 · 大屏组件（三问进行中 / 关系题投票 / 揭晓+讲解）
// 数据自取（内部轮询），与页面解耦。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { A0_INTRO, A0_VOTE_OPTIONS, A0_REVEAL } from '@/features/avatarLesson/config';
import ContentSlot from './ContentSlot';
import VideoSource from './VideoSource';
import { usePageOverrides, pageText } from '@/lib/usePageText';

interface A0Data {
  total: number;
  answered: number;
  voted: number;
  tool: number;
  partner: number;
  answerCountByQuestion: number[];
}

export default function AvatarA0Screen({
  type,
  sessionId,
  subState,
  total,
  playVideoUrl = null,
  onVideoEnded,
}: {
  type: string; // A0N_QUESTIONS | A0N_VOTE | A0N_REVEAL
  sessionId: string;
  subState: string | null;
  total: number;
  playVideoUrl?: string | null; // 教师端触发播放的视频 URL（瞬态）
  onVideoEnded?: () => void; // 视频放完，通知大屏收起
}) {
  const [data, setData] = useState<A0Data | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  // 播放序号：每次收到播放指令 +1，作为 <video> 的 key 强制全新挂载，保证同视频第二次也能重播
  const playSeq = useRef(0);
  const ov = usePageOverrides(subState);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/avatar/a0/analytics?sessionId=${sessionId}`);
        if (!closed) setData(await r.json());
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 教师端触发播放（module:playvideo）：收到就立即播放，放完自动收起
  useEffect(() => {
    if (playVideoUrl) {
      playSeq.current += 1;
      setPlayingVideo(playVideoUrl);
    }
  }, [playVideoUrl]);

  // 三问进行中（含开场页：P1 手指图 → P2 二维发展图 → 三问）
  if (type === 'A0N_QUESTIONS') {
    const s = String(subState ?? '');

    // P1 手指图 · 首次接触 AI 的故事
    if (s === 'a0:intro1') {
      const tEyebrow = pageText(ov, 'eyebrow', A0_INTRO.intro1.eyebrow);
      const tTitle = pageText(ov, 'title', A0_INTRO.intro1.title);
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
          {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
          {tTitle !== null && <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#fbbf24)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>
            {tTitle}
          </div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={A0_INTRO.intro1.image} alt="手指接触 AI 的瞬间" style={{ maxWidth: 'min(1100px, 90vw)', maxHeight: '64vh', objectFit: 'contain', borderRadius: 16 }} />
          <ContentSlot slot="a0_top" />
        </div>
      );
    }

    // P2 二维发展图 · 横轴时间 / 纵轴"人们开始用 AI 做什么"
    if (s === 'a0:intro2') {
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2vw' }}>
          <iframe src={A0_INTRO.intro2.image} title="AI 发展时间线" style={{ width: 'min(1700px, 100%)', height: '94vh', border: 'none', borderRadius: 0, background: '#0b1120' }} />
        </div>
      );
    }

    // 三问（默认）：大屏仍放二维发展图（让学生对照位置），学生手机回答三问
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2vw' }}>
        <iframe src={A0_INTRO.intro2.image} title="AI 发展时间线" style={{ width: 'min(1700px, 100%)', height: '94vh', border: 'none', borderRadius: 0, background: '#0b1120' }} />
      </div>
    );
  }

  // 关系判定中（系统后台判定）—— 已与揭晓结果页合并：同一画面，标题+大方框+百分比
  if (type === 'A0N_VOTE') {
    const tool = data?.tool ?? 0;
    const partner = data?.partner ?? 0;
    const voted = data?.voted ?? 0;
    const lp = voted > 0 ? Math.round((tool / Math.max(1, voted)) * 100) : 0;
    const pp = voted > 0 ? Math.round((partner / Math.max(1, voted)) * 100) : 0;
    return (
      <div className="a0-reveal">
        <ContentSlot slot="a0_top" />
        <div className="a0-reveal-statement">{A0_REVEAL.headline}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: 'min(1100px, 92vw)', marginTop: 6 }}>
          {A0_VOTE_OPTIONS.map((o) => {
            const p = o.id === 'tool' ? lp : pp;
            const lead = o.id === 'tool' ? tool >= partner : partner > tool;
            return (
              <div key={o.id} style={{ background: 'rgba(15,23,42,0.55)', border: lead ? '1px solid rgba(124,58,237,0.6)' : '1px solid var(--border)', borderRadius: 20, padding: '34px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 54 }}>{o.icon}</div>
                <div style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 4px' }}>{o.label}</div>
                <div style={{ fontSize: 15, color: 'var(--muted)' }}>{o.desc}</div>
                <div style={{ fontSize: 64, fontWeight: 900, marginTop: 14, color: lead ? '#c4b5fd' : '#e2e8f0' }}>{p}%</div>
              </div>
            );
          })}
        </div>
        <div className="a0-snap-note" style={{ marginTop: 14 }}>今天这节课，我们不急着下结论。先看看，把 AI 当工具的过去，和当伙伴的未来，流程差在哪。</div>
      </div>
    );
  }

  // A0-3 揭晓 + 讲解（教师用 subState: reveal:1/2/3[:n]/4[:n] 控制）
  const tool = data?.tool ?? 0;
  const partner = data?.partner ?? 0;
  const voted = Math.max(1, data?.voted ?? 1);
  const lp = Math.round((tool / voted) * 100);
  const pp = Math.round((partner / voted) * 100);
  const reveal = subState ?? 'reveal:1';
  const rs = String(reveal);

  // P4 镜子 · "我们在哪儿？" 心理停顿
  if (rs === 'a0:mirror') {
    const tEyebrow = pageText(ov, 'eyebrow', A0_INTRO.mirror.eyebrow);
    const tTitle = pageText(ov, 'title', A0_INTRO.mirror.title);
    const tBody1 = pageText(ov, 'body1', A0_INTRO.mirror.body1);
    const tBody2 = pageText(ov, 'body2', A0_INTRO.mirror.body2);
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '0 6vw' }}>
        {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
        {tTitle !== null && <div style={{ fontSize: 'clamp(40px,6vw,80px)', fontWeight: 900, background: 'linear-gradient(180deg,#f8fafc,#fbbf24)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          {tTitle}
        </div>}
        {tBody1 !== null && <div style={{ fontSize: 'clamp(20px,2.6vw,34px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 1000 }}>{tBody1}</div>}
        {tBody2 !== null && <div style={{ fontSize: 'clamp(20px,2.6vw,34px)', color: '#fde047', fontWeight: 800, lineHeight: 1.7, maxWidth: 1000 }}>{tBody2}</div>}
      </div>
    );
  }

  // P8 收束 · "这个东西已经来了"（电子海啸图 + 视频，视频由教师端触发播放）
  if (rs === 'a0:closing') {
    const tEyebrow = pageText(ov, 'eyebrow', A0_INTRO.closing.eyebrow);
    const tTitle = pageText(ov, 'title', A0_INTRO.closing.title);
    const tBody1 = pageText(ov, 'body1', A0_INTRO.closing.body1);
    const tBody2 = pageText(ov, 'body2', A0_INTRO.closing.body2);
    const videoFile = '1786677398421-7ncl82.mp4';
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center', padding: '0 2vw', overflowY: 'auto' }}>
        {tEyebrow !== null && <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.12em' }}>{tEyebrow}</div>}
        {tTitle !== null && <div style={{ fontSize: 'clamp(30px,4vw,52px)', fontWeight: 900, lineHeight: 1.3, background: 'linear-gradient(180deg,#f8fafc,#fb923c)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', maxWidth: 1000 }}>
          {tTitle}
        </div>}
        {tBody1 !== null && <div style={{ fontSize: 'clamp(17px,2.1vw,28px)', color: '#e2e8f0', lineHeight: 1.7, maxWidth: 900 }}>{tBody1}</div>}
        {tBody2 !== null && <div style={{ fontSize: 'clamp(17px,2.1vw,28px)', color: '#fde047', fontWeight: 700, lineHeight: 1.7, maxWidth: 900 }}>{tBody2}</div>}
        {/* 电子海啸图 · 尽量大、接近满屏 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={A0_INTRO.closing.image} alt="AI 就在我们身边" style={{ maxWidth: 'min(1600px, 96vw)', maxHeight: '82vh', objectFit: 'contain', borderRadius: 16 }} />
        {/* 预加载视频：进入本页就开始缓冲，教师端触发播放时秒开、不黑屏（本地优先，云端兜底） */}
        <div style={{ display: 'none' }} aria-hidden>
          <VideoSource fileName={videoFile} preload="auto" />
        </div>
        <ContentSlot slot="a0_reveal_after" />

        {playingVideo && (
          <div
            key={playSeq.current}
            style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
            onClick={() => { setPlayingVideo(null); onVideoEnded?.(); }}
          >
            <VideoSource
              fileName={String(playingVideo).split('/').pop() || videoFile}
              autoPlay
              playsInline
              onEnded={() => { setPlayingVideo(null); onVideoEnded?.(); }}
              style={{ width: '100vw', height: '100vh', objectFit: 'contain', background: '#000' }}
            />
          </div>
        )}
      </div>
    );
  }

  // 屏幕判定：reveal:3=工具伙伴两图，reveal:2=三种形态，其余=揭晓结果
  const isArt = /^reveal:3(?::\d+)?$/.test(rs);
  const screen = isArt ? 'art' : reveal === 'reveal:2' ? 'pvf' : 'result';
  const tHeadline = pageText(ov, 'headline', A0_REVEAL.headline);
  const tFormTitle = pageText(ov, 'screenTitle', A0_REVEAL.formsTable.title);
  const tFormSub = pageText(ov, 'screenQuestion', A0_REVEAL.formsTable.subtitle);

  return (
    <div className="a0-reveal">
      <ContentSlot slot="a0_top" />
      {screen === 'result' && (
        <>
          {tHeadline !== null && <div className="a0-reveal-statement">{tHeadline}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: 'min(1100px, 92vw)', marginTop: 6 }}>
            {A0_VOTE_OPTIONS.map((o) => {
              const p = o.id === 'tool' ? lp : pp;
              const lead = o.id === 'tool' ? tool >= partner : partner > tool;
              return (
                <div key={o.id} style={{ background: 'rgba(15,23,42,0.55)', border: lead ? '1px solid rgba(124,58,237,0.6)' : '1px solid var(--border)', borderRadius: 20, padding: '34px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 54 }}>{o.icon}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 4px' }}>{o.label}</div>
                  <div style={{ fontSize: 15, color: 'var(--muted)' }}>{o.desc}</div>
                  <div style={{ fontSize: 64, fontWeight: 900, marginTop: 14, color: lead ? '#c4b5fd' : '#e2e8f0' }}>{p}%</div>
                </div>
              );
            })}
          </div>
          <div className="a0-snap-note" style={{ marginTop: 14 }}>今天这节课，我们不急着下结论。先看看，把 AI 当工具的过去，和当伙伴的未来，流程差在哪。</div>
        </>
      )}

      {screen === 'pvf' && (
        <>
          {tFormTitle !== null && <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>{tFormTitle}</div>}
          {tFormSub !== null && <div className="a0-forms-sub">{tFormSub}</div>}
          <div className="a0-forms-table">
            <div className="a0-forms-header">
              <div className="a0-forms-dim" style={{ visibility: 'hidden' }}>维度</div>
              {A0_REVEAL.formsTable.columns.map((c, i) => (
                <div key={c} className={`a0-forms-col-h a0-forms-tone-${i}`}>{c}</div>
              ))}
            </div>
            {A0_REVEAL.formsTable.rows.map((row) => (
              <div className="a0-forms-row" key={row.dim}>
                <div className="a0-forms-dim">{row.dim}</div>
                {row.cells.map((cell, i) => (
                  <div key={i} className={`a0-forms-cell a0-forms-tone-${i}`}>{cell}</div>
                ))}
              </div>
            ))}
            <div className="a0-forms-row a0-forms-punchline">
              <div className="a0-forms-dim">{A0_REVEAL.formsTable.punchline.label}</div>
              {A0_REVEAL.formsTable.punchline.cells.map((cell, i) => (
                <div key={i} className={`a0-forms-cell a0-forms-tone-${i}`}><strong>{cell}</strong></div>
              ))}
            </div>
          </div>
          <ContentSlot slot="a0_forms_after" />
        </>
      )}

      {screen === 'art' && (
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center', justifyContent: 'center', padding: '0 2vw' }}>
          {A0_REVEAL.artImages.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`A0 关系图 ${i + 1}`} style={{ width: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 16 }} />
          ))}
        </div>
      )}

      <ContentSlot slot="a0_reveal_after" />
    </div>
  );
}
