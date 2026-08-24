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
import { getCachedVideo } from '@/lib/videoCache';
import { isPreviewMode } from '@/lib/preview-mode';
import { withBasePath } from '@/lib/basePath';
import VideoPreviewPlaceholder from '@/components/VideoPreviewPlaceholder';

interface SmartVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export default function SmartVideo({ src, ...rest }: SmartVideoProps) {
  const [base, setBase] = useState<string | null>(null);
  // base 是否已解析完成（含为 null 的情况）。未完成前不渲染 <video>，
  // 避免浏览器先看到云端 <source> 就锁定源，等本地 base 到了也不切换。
  const [baseReady, setBaseReady] = useState(false);
  // 真·预读：本地缓存命中时的 blob URL（相对路径 src 才查缓存）
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);

  // 预览模式双阶段渲染：SSR 与首帧统一占位骨架，避免 hydration mismatch；
  // 预览模式不创建 <video>、不预加载、不播放（autoPlay 由父传，前端带 preview=1 直接占位）。
  const [preview] = useState(() => typeof window !== 'undefined' && isPreviewMode());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (preview) return; // 预览模式不拉取视频基址
    getVideoBase()
      .then(setBase)
      .catch(() => {})
      .finally(() => setBaseReady(true));
  }, [preview]);

  // 真·预读：相对路径 src 优先查本地缓存（IndexedDB），命中则用 blob 直播
  useEffect(() => {
    if (preview) return;
    if (/^https?:\/\//i.test(src)) {
      setCacheChecked(true);
      return;
    }
    let closed = false;
    getCachedVideo(src)
      .then((blob) => {
        if (closed || !blob) return;
        setCachedUrl(URL.createObjectURL(blob));
      })
      .catch(() => {})
      .finally(() => {
        if (!closed) setCacheChecked(true);
      });
    return () => {
      closed = true;
    };
  }, [src, preview]);

  if (!mounted) return <VideoPreviewPlaceholder />; // SSR 与首帧统一占位骨架，避免 hydration mismatch
  if (preview) return <VideoPreviewPlaceholder />;  // 预览模式：不创建 <video>
  if (cacheChecked && cachedUrl) {
    return <video src={cachedUrl} {...rest} />;
  }
  if (!baseReady) return <VideoPreviewPlaceholder />; // 等 base 解析完再渲染 <video>，保证 source 列表一次到位（本地在前）

  // 绝对 URL 直接用 src 属性；相对路径走 <source> 列表（base 优先在前）
  if (/^https?:\/\//i.test(src)) {
    return <video src={src} {...rest} />;
  }

  return (
    <video {...rest}>
      {base ? (
        <source key={`${base}${src.startsWith('/') ? '' : '/'}${src}`} src={`${base}${src.startsWith('/') ? '' : '/'}${src}`} />
      ) : null}
      <source key={src} src={withBasePath(src)} />
    </video>
  );
}