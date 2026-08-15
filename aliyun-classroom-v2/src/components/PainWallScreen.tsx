'use client';
// =========================================================
// 收官模块 · 第一屏「痛点墙」大屏组件
// 嵌入 public/pain-wall.html（AI 自己的坑 / 我们自己的坑 逐张点亮）。
// 教师端按钮通过 moduleSubState 控制：pain:0 全灭 / 1..8 逐张点亮。
// 本组件把 subState 转成 step 后 postMessage 给 iframe，老师无需在大屏上操作。
// =========================================================
import { useEffect, useRef } from 'react';

export default function PainWallScreen({ subState }: { subState: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSent = useRef<number>(-1);

  // subState → step（0 全灭，1..8 逐张点亮）。支持 closing:pain:N 与 pain:N 两种格式
  const step = (() => {
    const m = String(subState ?? '').match(/(?:^|:)pain:(\d+)$/);
    if (m) return Math.max(0, Math.min(8, parseInt(m[1], 10)));
    return 0;
  })();

  // 发送 step 到 iframe（兼容 iframe 尚未加载完成的时序：等 load 后再补发）
  useEffect(() => {
    const send = () => {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'painwall', step }, '*');
        lastSent.current = step;
      }
    };
    send();
    const t = setTimeout(send, 600);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <iframe
        ref={iframeRef}
        src="/pain-wall.html"
        title="痛点墙"
        onLoad={() => {
          if (lastSent.current !== step) {
            const w = iframeRef.current?.contentWindow;
            w?.postMessage({ type: 'painwall', step }, '*');
            lastSent.current = step;
          }
        }}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
