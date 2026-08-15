'use client';
// =========================================================
// 收官模块 · 环节「价格颁布」大屏组件
// 嵌入 public/price-reveal.html（锚点 ¥39 → ¥3,300-9,800 → 悬念 → ¥299 揭晓 → 三组价值+CTA）。
// 教师端按钮通过 moduleSubState 控制：closing:price:0..6 逐步推进。
// 本组件把 subState 转成 step 后 postMessage 给 iframe，老师无需在大屏上操作。
// =========================================================
import { useEffect, useRef } from 'react';

export default function PriceRevealScreen({ subState }: { subState: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSent = useRef<number>(-1);

  // subState → step（0..21：0-6 前七屏，7-20 三列价值 build 子步，21 全显+CTA）
  const step = (() => {
    const m = String(subState ?? '').match(/(?:^|:)price:(\d+)$/);
    if (m) return Math.max(0, Math.min(21, parseInt(m[1], 10)));
    return 0;
  })();

  useEffect(() => {
    const send = () => {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'pricereveal', step }, '*');
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
        src="/price-reveal.html"
        title="价格颁布"
        onLoad={() => {
          if (lastSent.current !== step) {
            const w = iframeRef.current?.contentWindow;
            w?.postMessage({ type: 'pricereveal', step }, '*');
            lastSent.current = step;
          }
        }}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
