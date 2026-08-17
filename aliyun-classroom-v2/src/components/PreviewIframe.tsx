'use client';
// =========================================================
// 预览 iframe：把大屏/学生端页面整体等比缩小，塞进教师端窗口宽度，整页都能看清。
// iframe 内部按固定 1280 宽渲染（布局不换行、不截断），外层用 transform: scale 缩小显示。
// 用法：<PreviewIframe src="..." height={200} title="大屏预览" />
// =========================================================
import { useEffect, useRef, useState } from 'react';

const DESIGN_WIDTH = 1280; // 内部页面设计宽度（大屏/学生端按这个宽度布局）
const DESIGN_HEIGHT = 720; // 内部页面设计高度

export default function PreviewIframe({
  src,
  height = 200,
  title,
}: {
  src: string;
  height?: number;
  title: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(DESIGN_WIDTH);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth || DESIGN_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = boxW > 0 ? boxW / DESIGN_WIDTH : 0;

  return (
    <div ref={boxRef} style={{ width: '100%', position: 'relative' }}>
      <div style={{ height, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--border)', position: 'relative', background: '#070b16' }}>
        <iframe
          src={src}
          title={title}
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>
    </div>
  );
}
