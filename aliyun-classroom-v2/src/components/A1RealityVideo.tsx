'use client';
// =========================================================
// A1 现实：一人公司 · 内置视频页
// 视频仅真正大屏播放（预览模式 preview=1 不播，只显示标题占位）。
// 进页自动播放；教师端环节页下的控制条通过 module:playvideo 广播
// play / pause / stop 控制本视频。大屏上不放任何控制按钮。
// =========================================================
import { useEffect, useRef } from 'react';

export default function A1RealityVideo({
  fileName,
  title,
  videoCmd = null,
  isPreview = false,
  onEnded,
}: {
  fileName: string;
  title: string;
  videoCmd?: { action: 'play' | 'pause' | 'stop'; url?: string } | null;
  isPreview?: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const endedRef = useRef(false);

  // 进页自动播放（仅真大屏）：手动 play() 替代 autoPlay 属性
  useEffect(() => {
    if (isPreview) return;
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      try {
        v.currentTime = 0;
        endedRef.current = false;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* 被拦时由教师端控制条触发 */ });
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
  }, [isPreview]);

  // 教师端视频控制指令（module:playvideo）
  useEffect(() => {
    if (isPreview) return;
    const v = ref.current;
    if (!v) return;
    const action = videoCmd?.action;
    if (action === 'play') {
      if (videoCmd?.url && String(videoCmd.url).split('/').pop() !== fileName) return; // 不是本视频，忽略
      try {
        if (endedRef.current) { v.currentTime = 0; endedRef.current = false; }
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* noop */ });
      } catch { /* noop */ }
    } else if (action === 'pause') {
      v.pause();
    } else if (action === 'stop') {
      v.pause();
      v.currentTime = 0;
      endedRef.current = false;
    }
  }, [videoCmd, isPreview, fileName]);

  // 预览模式（教师端）：只显示标题占位，不渲染视频
  if (isPreview) {
    return (
      <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 22, fontWeight: 700 }}>
          {title}
          <div style={{ fontSize: 14, fontWeight: 400, marginTop: 8 }}>视频仅在真正大屏播放（教师端预览不播）</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video
        ref={ref}
        preload="auto"
        playsInline
        onEnded={() => { endedRef.current = true; onEnded?.(); }}
        style={{ width: 'min(1200px, 92vw)', maxHeight: '88vh', borderRadius: 16, background: '#000' }}
      >
        <source src={`/videos/${fileName}`} />
        <source src={`/api/media/file/${fileName}`} />
      </video>
    </div>
  );
}