'use client';
// =========================================================
// A1 现实：一人公司 · 内置视频页
// 进页自动播放（手动 play() 替代 autoPlay 属性），页面内直接显示视频，
// 下方控制条：播放 / 暂停 / 停止。笔记本源优先，云端兜底。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { getVideoBase } from '@/lib/video-src';

export default function A1RealityVideo({ fileName }: { fileName: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [base, setBase] = useState<string | null>(null);

  // 拉取教室笔记本视频服务基址（运行时配置，教师端保存后全局生效）
  useEffect(() => {
    getVideoBase().then(setBase).catch(() => {});
  }, []);

  // 进页自动播放：等元数据就绪后手动 play()（自动播放策略只拦属性、不拦 play()）
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      try {
        v.currentTime = 0;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* 被拦时等控制条手动播 */ });
      } catch { /* noop */ }
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start);
    const t = setTimeout(start, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
      v.removeEventListener('loadedmetadata', start);
    };
  }, []);

  const play = () => { ref.current?.play().catch(() => { /* noop */ }); };
  const pause = () => ref.current?.pause();
  const stop = () => { const v = ref.current; if (v) { v.pause(); v.currentTime = 0; } };

  const btn: React.CSSProperties = {
    padding: '10px 22px', borderRadius: 999, fontSize: 15, fontWeight: 700,
    border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer',
  };

  return (
    <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <video
        ref={ref}
        preload="auto"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ width: 'min(1200px, 92vw)', maxHeight: '74vh', borderRadius: 16, background: '#000' }}
      >
        {base ? <source src={`${base}/videos/${fileName}`} /> : null}
        <source src={`/videos/${fileName}`} />
        <source src={`/api/media/file/${fileName}`} />
      </video>
      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{ ...btn, ...(playing ? { opacity: 0.5, cursor: 'default' } : { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)', color: '#86efac' }) }} onClick={play} disabled={playing}>▶ 播放</button>
        <button style={{ ...btn, ...(playing ? { background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.5)', color: '#fde68a' } : { opacity: 0.5, cursor: 'default' }) }} onClick={pause} disabled={!playing}>⏸ 暂停</button>
        <button style={{ ...btn, ...{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' } }} onClick={stop}>⏹ 停止</button>
      </div>
    </div>
  );
}
