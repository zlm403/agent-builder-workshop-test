'use client';
// =========================================================
// 大屏 · 公共共生缸
// 实时渲染全班数字生命 + 随机事件光束，供学生观察。
// 轮询 /api/grow-game/tank 获取已投入的生命。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import {
  createLife, updateLife, hitLife, drawLife,
  createEvent, updateEvent, drawEvent, drawBackground,
  type TankLife, type TankEvent, type LifeDesign,
} from '@/lib/tankEngine';

interface TankLifeItem {
  id: string;
  name: string;
  trait: string;
  design: LifeDesign;
  energy?: number;
}

export default function Tank({ sessionId }: { sessionId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const livesRef = useRef<TankLife[]>([]);
  const eventsRef = useRef<TankEvent[]>([]);
  const hueRef = useRef(Math.random() * 360);

  // 拉取全班生命
  useEffect(() => {
    let closed = false;
    async function fetchLives() {
      try {
        const r = await fetch(`/api/grow-game/tank?sessionId=${sessionId}`);
        const d = await r.json();
        if (closed) return;
        const items: TankLifeItem[] = d.lives ?? [];
        setCount(items.length);
        const canvas = canvasRef.current;
        const W = canvas?.width ? canvas.width / (window.devicePixelRatio || 1) : 1200;
        const H = canvas?.height ? canvas.height / (window.devicePixelRatio || 1) : 700;
        // 合并：保留已有（避免跳动），新增的创建
        const existing = livesRef.current;
        const map = new Map(existing.map((l) => [l.id, l]));
        for (const it of items) {
          if (!map.has(it.id)) {
            map.set(it.id, createLife(it.id, it.name, it.trait, it.design, W, H, hueRef.current));
            hueRef.current += 47;
          }
        }
        // 移除不存在的
        const ids = new Set(items.map((i) => i.id));
        livesRef.current = [...map.values()].filter((l) => ids.has(l.id));
      } catch { /* noop */ }
    }
    fetchLives();
    const iv = setInterval(fetchLives, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let spawnTimer = 0;
    let frame = 0;
    const W = () => canvasRef.current?.clientWidth ?? 1200;
    const H = () => canvasRef.current?.clientHeight ?? 700;

    function loop() {
      frame++;
      const w = W(), h = H();
      // 生成事件（最多 10）
      spawnTimer--;
      if (spawnTimer <= 0 && eventsRef.current.length < 10) {
        eventsRef.current.push(createEvent(w, h));
        spawnTimer = 40;
      }
      // 更新事件 + 撞击
      for (let i = eventsRef.current.length - 1; i >= 0; i--) {
        const ev = eventsRef.current[i];
        updateEvent(ev, w, h);
        if (ev.life <= 0) { eventsRef.current.splice(i, 1); continue; }
        for (const life of livesRef.current) {
          const d = Math.hypot(ev.x - life.x, ev.y - life.y);
          if (d < ev.size + 26) hitLife(life, ev, ev.size * 0.012);
        }
      }
      // 更新生命
      for (const life of livesRef.current) updateLife(life, livesRef.current, eventsRef.current, w, h, 1);
      // 绘制
      drawBackground(ctx, w, h, frame);
      for (const ev of eventsRef.current) drawEvent(ctx, ev);
      for (const life of livesRef.current) drawLife(ctx, life);
      raf = requestAnimationFrame(loop);
    }
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 14, color: 'var(--muted)', background: 'rgba(0,0,0,.5)', padding: '6px 12px', borderRadius: 999 }}>
        🌍 共生缸 · {count} 个生命
      </div>
    </div>
  );
}
