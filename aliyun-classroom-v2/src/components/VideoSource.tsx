'use client';
// =========================================================
// 视频源组件：优先读教室笔记本本地服务（教师端运行时配置，局域网快），
// 笔记本不可达自动回退 /videos/{fileName} → /api/media/file/{fileName}（云端兜底）
// 所有视频引用统一走这里，保证本地离线可用、云端备份兜底。
//
// 不依赖 autoPlay 属性：大屏/学生端没有用户手势，浏览器会拦截有声自动播放。
// 组件挂载后手动调用 video.play()（自动播放策略只拦属性、不拦 play() 在有预加载时）。
// 每次挂载重置 currentTime=0，避免同视频第二次播放停在 ended 状态。
//
// 用法：<VideoSource fileName="xxx.mp4" preload="auto" onEnded={...} />
//       autoPlay 模式下建议外层用 <div key={播放次数}> 强制每次全新挂载，确保每次都能重播。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { getVideoBase } from '@/lib/video-src';
import { isPreviewMode } from '@/lib/preview-mode';
import VideoPreviewPlaceholder from '@/components/VideoPreviewPlaceholder';

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
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [base, setBase] = useState<string | null>(null);

  // 预览模式双阶段渲染：SSR 与首帧统一占位骨架，避免 hydration mismatch；
  // 预览模式不创建 <video>、不预加载、不播放。
  const [preview] = useState(() => typeof window !== 'undefined' && isPreviewMode());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 拉取教室笔记本视频服务基址（运行时配置，教师端保存后全局生效）；预览模式不拉取
  useEffect(() => {
    if (preview) return;
    getVideoBase().then(setBase).catch(() => {});
  }, [preview]);

  // 笔记本优先，云端兜底；浏览器按 <source> 顺序自动回退（base 已含协议域端口，直接拼 /videos/）
  const sources = [
    ...(base ? [`${base}/videos/${fileName}`] : []),
    `/videos/${fileName}`,
    `/api/media/file/${fileName}`,
  ];

  useEffect(() => {
    if (preview) return; // 预览模式绝不触发播放
    const v = ref.current;
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
  }, [autoPlay, preview]);

  if (!mounted) return <VideoPreviewPlaceholder />; // SSR 与首帧统一占位骨架，避免 hydration mismatch
  if (preview) return <VideoPreviewPlaceholder />;  // 预览模式：不创建 <video>

  return (
    <video
      ref={ref}
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
