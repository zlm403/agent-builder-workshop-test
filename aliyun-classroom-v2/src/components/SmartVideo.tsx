'use client';
// =========================================================
// 统一视频渲染组件：相对路径 src 优先从教室笔记本本地服务读（局域网快），
// 笔记本不可达时浏览器自动回退 <source> 里的下一条（/videos/ → /api/media/file/）。
// src 若是绝对 http(s) URL 直接当 src 属性用（不加 base）。
// 用法：<SmartVideo src={it.url} controls autoPlay playsInline style={...} />
//       其余 video 属性 + React key 均由调用方透传。
// =========================================================
import { useEffect, useState } from 'react';
import { getVideoBase } from '@/lib/video-src';
import { isPreviewMode } from '@/lib/preview-mode';
import VideoPreviewPlaceholder from '@/components/VideoPreviewPlaceholder';

interface SmartVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export default function SmartVideo({ src, ...rest }: SmartVideoProps) {
  const [base, setBase] = useState<string | null>(null);

  // 预览模式双阶段渲染：SSR 与首帧统一占位骨架，避免 hydration mismatch；
  // 预览模式不创建 <video>、不预加载、不播放（autoPlay 由父传，前端带 preview=1 直接占位）。
  const [preview] = useState(() => typeof window !== 'undefined' && isPreviewMode());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (preview) return; // 预览模式不拉取视频基址
    getVideoBase().then(setBase).catch(() => {});
  }, [preview]);

  if (!mounted) return <VideoPreviewPlaceholder />; // SSR 与首帧统一占位骨架，避免 hydration mismatch
  if (preview) return <VideoPreviewPlaceholder />;  // 预览模式：不创建 <video>

  // 绝对 URL 直接用 src 属性；相对路径走 <source> 列表（base 优先在前）
  if (/^https?:\/\//i.test(src)) {
    return <video src={src} {...rest} />;
  }

  return (
    <video {...rest}>
      {base ? (
        <source key={`${base}${src.startsWith('/') ? '' : '/'}${src}`} src={`${base}${src.startsWith('/') ? '' : '/'}${src}`} />
      ) : null}
      <source key={src} src={src} />
    </video>
  );
}