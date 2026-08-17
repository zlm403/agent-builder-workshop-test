'use client';
// =========================================================
// 预览 iframe：把大屏/学生端页面整体等比缩小，塞进教师端窗口宽度，整页都能看清。
// 用 CSS zoom（布局级缩放，占位也跟着缩）而非 transform: scale（只缩视觉、不缩占位，会撑爆布局）。
//
// 三道保险，避免撑爆挤压左侧：
// 1. scale 初始为 0 → 测到真实容器宽度前不渲染 iframe
// 2. 容器高度 = 设计高度 * scale，动态计算，不写死
// 3. 双层 overflow: hidden 兜底
// =========================================================
import { useEffect, useRef, useState } from 'react';

const DESIGN_W = 1280; // 内部页面设计宽度
const DESIGN_H = 720; // 内部页面设计高度

export default function PreviewIframe({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0); // 初始 0：不渲染 iframe，杜绝撑爆

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(w / DESIGN_W, 1));
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const height = scale > 0 ? Math.round(DESIGN_H * scale) : 0;
  const iframeStyle: Record<string, string | number> = {
    width: DESIGN_W,
    height: DESIGN_H,
    border: 'none',
    display: 'block',
    transformOrigin: '0 0',
    zoom: scale,
  };

  return (
    <div ref={boxRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ height: height || 1, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: '#070b16' }}>
        {scale > 0 && <iframe src={src} title={title} style={iframeStyle as React.CSSProperties} />}
      </div>
    </div>
  );
}
