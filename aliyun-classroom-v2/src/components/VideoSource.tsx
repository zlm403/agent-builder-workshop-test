'use client';
// =========================================================
// 视频源组件：优先读本地 public/videos/{fileName}，本地没有/404 自动回退云端 /api/media/file/{fileName}
// 所有视频引用统一走这里，保证本地离线可用、云端备份兜底。
//
// 不依赖 autoPlay 属性：大屏/学生端没有用户手势，浏览器会拦截有声自动播放。
// 组件挂载后手动调用 video.play()（自动播放策略只拦属性、不拦 play() 在有预加载时）。
// 每次挂载重置 currentTime=0，避免同视频第二次播放停在 ended 状态。
//
// 用法：<VideoSource fileName="xxx.mp4" preload="auto" onEnded={...} />
//       autoPlay 模式下建议外层用 <div key={播放次数}> 强制每次全新挂载，确保每次都能重播。
// =========================================================
import { useEffect, useRef } from 'react';

export default function VideoSource({
  fileName,
  preload = 'auto',
  autoPlay = false,
  muted = false,
  playsInline = true,
  loop = false,
  onEnded,
  onClick,
  style,
  videoRef,
}: {
  fileName: string;
  preload?: 'auto' | 'metadata' | 'none';
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const innerRef = useRef<HTMLVideoElement | null>(null);

  // 本地优先，云端兜底；浏览器按 <source> 顺序自动回退
  const sources = [`/videos/${fileName}`, `/api/media/file/${fileName}`];

  const refToUse = videoRef ?? innerRef;

  useEffect(() => {
    const v = refToUse.current;
    if (!v) return;
    let cancelled = false;
    if (autoPlay) {
      // 手动 play() 替代 autoPlay 属性：重置到开头，避免停在上次的 ended 状态
      const start = () => {
        if (cancelled) return;
        try {
          v.currentTime = 0;
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => { /* 自动播放被拦时静默，等用户交互 */ });
        } catch { /* noop */ }
      };
      // 等元数据/首个 source 就绪后再播；已就绪则立即播
      if (v.readyState >= 1) start();
      else v.addEventListener('loadedmetadata', start);
      // 兜底：有些浏览器 <source> 切换后 loadedmetadata 不触发，用 timeout 强试一次
      const t = setTimeout(start, 1200);
      return () => {
        cancelled = true;
        clearTimeout(t);
        v.removeEventListener('loadedmetadata', start);
      };
    }
    return () => { cancelled = true; };
  }, [autoPlay]);

  return (
    <video
      ref={refToUse}
      preload={preload}
      muted={muted}
      playsInline={playsInline}
      loop={loop}
      onEnded={onEnded}
      onClick={onClick}
      style={style}
    >
      {sources.map((src) => (
        <source key={src} src={src} />
      ))}
    </video>
  );
}
