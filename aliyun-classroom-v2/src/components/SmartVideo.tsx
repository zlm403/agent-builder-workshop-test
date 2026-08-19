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

interface SmartVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export default function SmartVideo({ src, ...rest }: SmartVideoProps) {
  const [base, setBase] = useState<string | null>(null);

  useEffect(() => {
    getVideoBase().then(setBase).catch(() => {});
  }, []);

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