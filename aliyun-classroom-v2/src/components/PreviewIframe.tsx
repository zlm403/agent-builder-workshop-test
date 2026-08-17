'use client';
// =========================================================
// 预览 iframe：把大屏/学生端页面整体等比缩小，塞进教师端窗口宽度，整页都能看清。
// 用 transform: scale（不改 iframe 内部视口，视觉等比缩小，内容不会放大溢出）。
// 关键：iframe 用 absolute 定位（不占布局流，不会撑爆卡片），容器高度=设计高度*scale 动态计算。
//
// 保险：scale 初始 0（测到真实宽度前不渲染）；容器 overflow:hidden 兜底；scale 上限 1。
// =========================================================
import { useEffect, useRef, useState } from 'react';

const DESIGN_W = 1280; // 内部页面设计宽度
const DESIGN_H = 720; // 内部页面设计高度

export default function PreviewIframe({
  src,
  title,
  maxWidth,
}: {
  src: string;
  title: string;
  maxWidth?: number; // 预览最大宽度上限（px），避免在宽屏上被拉得太大、超出边界
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

  return (
    <div ref={boxRef} style={{ width: '100%', maxWidth: maxWidth ?? '100%', margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%', height: height || 1, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: '#070b16' }}>
        {scale > 0 && (
          <iframe
            src={src}
            title={title}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_W,
              height: DESIGN_H,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          />
        )}
      </div>
    </div>
  );
}
