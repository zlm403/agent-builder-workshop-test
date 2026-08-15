'use client';
// =========================================================
// 收官模块 · 第一屏「四翼展示」大屏组件
// 嵌入 public/four-wings.html（创造/驾驭/成长/传播 逐步点亮 + 成长链）。
// 教师端按钮通过 moduleSubState 控制：wings:0 开场 / 1..4 点亮各翼 / 5 成长链。
// 本组件把 subState 转成 step 后 postMessage 给 iframe，老师无需在大屏上操作。
// =========================================================
import { useEffect, useRef } from 'react';

export default function FourWingsScreen({ subState }: { subState: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSent = useRef<number>(-1);

  // subState → step（0 开场，1..4 点亮各翼，5 成长链）
  const step = (() => {
    const m = String(subState ?? '').match(/^wings:(\d+)$/);
    if (m) return Math.max(0, Math.min(5, parseInt(m[1], 10)));
    return 0;
  })();

  // 发送 step 到 iframe（兼容 iframe 尚未加载完成的时序：等 load 后再补发）
  useEffect(() => {
    const send = () => {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'fourwings', step }, '*');
        lastSent.current = step;
      }
    };
    // 立即尝试 + 监听 iframe 加载完成后补发当前 step
    send();
    const t = setTimeout(send, 600);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <iframe
        ref={iframeRef}
        src="/four-wings.html"
        title="四翼展示"
        onLoad={() => {
          if (lastSent.current !== step) {
            const w = iframeRef.current?.contentWindow;
            w?.postMessage({ type: 'fourwings', step }, '*');
            lastSent.current = step;
          }
        }}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
