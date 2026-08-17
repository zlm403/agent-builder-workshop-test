'use client';
// =========================================================
// 视频源组件：优先读本地 public/videos/{fileName}，本地没有/404 自动回退云端 /api/media/file/{fileName}
// 所有视频引用统一走这里，保证本地离线可用、云端备份兜底。
// 用法：<VideoSource fileName="xxx.mp4" preload="auto" autoPlay onEnded={...} />
// =========================================================

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
  // 本地优先，云端兜底；浏览器按 <source> 顺序自动回退
  const sources = [`/videos/${fileName}`, `/api/media/file/${fileName}`];
  return (
    <video
      preload={preload}
      autoPlay={autoPlay}
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
