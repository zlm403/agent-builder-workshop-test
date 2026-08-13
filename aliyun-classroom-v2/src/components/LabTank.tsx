'use client';
// =========================================================
// 小屏 · 个人实验缸
// 学生设计生命后先在这里试运行：看自己的生命怎么动、怎么被事件撞。
// 提供"主动试撞"按钮：投一束光撞它 / 放一个邻居生命碰它。
// =========================================================
import { useEffect, useRef } from 'react';
import {
  createLife, updateLife, hitLife, drawLife,
  createEvent, updateEvent, drawEvent, drawBackground,
  type TankLife, type TankEvent, type LifeDesign,
} from '@/lib/tankEngine';

export default function LabTank({
  name,
  trait,
  design,
  hue,
}: {
  name: string;
  trait: string;
  design: LifeDesign;
  hue: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lifeRef = useRef<TankLife | null>(null);
  const eventsRef = useRef<TankEvent[]>([]);
  const neighborRef = useRef<TankLife | null>(null);

  // 初始化生命
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    lifeRef.current = createLife('me', name || '我的生命', trait, design, r.width, r.height, hue || 190);
    // 初始放一个邻居（用于"碰一下"）
    neighborRef.current = createLife('nbr', '邻居', '友善', { hue: 40, movement: 'explore' }, r.width, r.height, 40);
    neighborRef.current.x = r.width * 0.7;
    neighborRef.current.y = r.height * 0.4;
  }, [name, trait, design, hue]);

  // 主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      const rr = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = rr.width * dpr;
      c.height = rr.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let frame = 0;
    const W = () => canvasRef.current?.clientWidth ?? 300;
    const H = () => canvasRef.current?.clientHeight ?? 200;

    function loop() {
      frame++;
      const w = W(), h = H();
      // 偶发一个事件（安静时也会偶尔来）
      if (eventsRef.current.length < 2 && Math.random() < 0.005) {
        eventsRef.current.push(createEvent(w, h));
      }
      for (let i = eventsRef.current.length - 1; i >= 0; i--) {
        const ev = eventsRef.current[i];
        updateEvent(ev, w, h);
        if (ev.life <= 0) { eventsRef.current.splice(i, 1); continue; }
        const life = lifeRef.current;
        if (life) {
          const d = Math.hypot(ev.x - life.x, ev.y - life.y);
          if (d < ev.size + 26) hitLife(life, ev, ev.size * 0.02);
        }
      }
      const life = lifeRef.current;
      if (life) {
        const others = neighborRef.current ? [neighborRef.current] : [];
        updateLife(life, others, eventsRef.current, w, h, 1);
        if (neighborRef.current) updateLife(neighborRef.current, [life], eventsRef.current, w, h, 1);
      }
      drawBackground(ctx, w, h, frame);
      for (const ev of eventsRef.current) drawEvent(ctx, ev);
      if (life) drawLife(ctx, life);
      if (neighborRef.current) drawLife(ctx, neighborRef.current);
      raf = requestAnimationFrame(loop);
    }
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 主动试撞：投一束光撞它
  function fireEvent() {
    const canvas = canvasRef.current;
    const life = lifeRef.current;
    if (!canvas || !life) return;
    const ev = createEvent(canvas.clientWidth, canvas.clientHeight);
    // 朝生命方向发射
    const dx = life.x - ev.x, dy = life.y - ev.y;
    const d = Math.hypot(dx, dy) + 0.001;
    ev.dirx = dx / d; ev.diry = dy / d;
    ev.baseSpeed = 2.2; ev.speed = 2.2;
    eventsRef.current.push(ev);
  }

  // 主动试撞：放一个邻居碰它
  function bumpNeighbor() {
    const canvas = canvasRef.current;
    const life = lifeRef.current;
    const nbr = neighborRef.current;
    if (!canvas || !life || !nbr) return;
    nbr.x = life.x + 40; nbr.y = life.y + 20;
    nbr.vx = (life.x - nbr.x) * 0.05;
    nbr.vy = (life.y - nbr.y) * 0.05;
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 220, display: 'block' }} />
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button className="secondary" style={{ flex: 1, fontSize: 12 }} onClick={fireEvent}>⚡ 让事件撞我一下</button>
        <button className="secondary" style={{ flex: 1, fontSize: 12 }} onClick={bumpNeighbor}>🤝 和邻居碰一下</button>
      </div>
    </div>
  );
}
