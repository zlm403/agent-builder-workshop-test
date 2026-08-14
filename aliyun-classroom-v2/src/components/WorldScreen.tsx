'use client';
// =========================================================
// 《我的世界》大屏端：左侧世界状态 + 中央 Canvas 公共世界 + 右侧关键动态
// 渲染：生命 = 发光光斑（大小限范围，颜色=学生选择）；资源 = 金色光点；
//       事件 = 带 2 字标签的彩色光点（从发生位置飘出、上浮淡出）。
// 用 requestAnimationFrame 持续渲染，两次轮询间生命位置 lerp 插值，让移动平滑。
// 逻辑与数据全部来自 /api/world（引擎），本组件只负责视觉。
// =========================================================
import { useEffect, useRef, useState } from 'react';

interface WorldLife {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  energy: number;
  state: 'active' | 'sleeping';
  action: string;
  reason: string;
  activeVersion: number;
  importantRelations?: { lifeId: string; value: number }[];
}

interface Resource {
  id: string;
  x: number;
  y: number;
}

interface KeyEvent {
  t: number;
  text: string;
  lifeId?: string;
}

interface WorldData {
  status: string;
  round: number;
  simulationTime: number;
  lives: WorldLife[];
  resources: Resource[];
  keyEvents: KeyEvent[];
}

// 事件光点（客户端瞬态，不上报、不进引擎）
interface FxLight {
  x: number; // 0..1 世界坐标
  y: number;
  label: string;
  color: string;
  born: number; // 出生时间戳
  life: number; // 存活 ms
}

// 生命大小范围（世界坐标归一化后的像素基准在 draw 里换算）
const LIFE_SIZE_MIN = 8;
const LIFE_SIZE_MAX = 16;
const FX_LIFE = 1800; // 事件光点存活 1.8s

// 事件标签映射：从事件文本关键词 → 标签 + 颜色
function fxForEvent(text: string): { label: string; color: string } | null {
  if (text.includes('帮助')) return { label: '帮助', color: '#34d399' };
  if (text.includes('苏醒')) return { label: '苏醒', color: '#fbbf24' };
  if (text.includes('休眠')) return { label: '休眠', color: '#94a3b8' };
  if (text.includes('回避')) return { label: '回避', color: '#c77dff' };
  if (text.includes('靠近')) return { label: '靠近', color: '#38bdf8' };
  return null;
}

// 稳定 hash：同一生命大小固定（在范围内）
function sizeOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return LIFE_SIZE_MIN + (h % (LIFE_SIZE_MAX - LIFE_SIZE_MIN));
}

export default function WorldScreen({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<WorldData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 渲染层状态（ref，不进 React 重渲染）
  const dataRef = useRef<WorldData | null>(null);
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  const fxRef = useRef<FxLight[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // 轮询数据
  useEffect(() => {
    let closed = false;
    async function load() {
      try {
        const r = await fetch(`/api/world?view=screen&sessionId=${sessionId}`);
        const d = await r.json();
        if (!closed) { dataRef.current = d; setData(d); }
      } catch { /* noop */ }
    }
    load();
    const t = setInterval(load, 2000);
    return () => { closed = true; clearInterval(t); };
  }, [sessionId]);

  // rAF 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(now: number) {
      const dt = Math.min(100, now - last);
      last = now;
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = rect.width;
      const H = rect.height;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);

      const d = dataRef.current;

      // 深海渐变背景
      const bg = ctx!.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a1d2f');
      bg.addColorStop(0.5, '#071525');
      bg.addColorStop(1, '#04101c');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      if (d) {
        // 收集新事件 → 生成光点
        for (const e of d.keyEvents) {
          const key = `${e.t}-${e.text}`;
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          const fx = fxForEvent(e.text);
          if (fx && e.lifeId) {
            const src = d.lives.find((l) => l.id === e.lifeId);
            fxRef.current.push({
              x: src?.x ?? 0.5,
              y: src?.y ?? 0.5,
              label: fx.label,
              color: fx.color,
              born: now,
              life: FX_LIFE,
            });
          }
        }

        // 生命位置 lerp 到目标
        const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k);
        const targets: Record<string, { x: number; y: number }> = {};
        for (const l of d.lives) targets[l.id] = { x: l.x, y: l.y };
        // 移除已不存在的生命
        for (const id of Object.keys(posRef.current)) {
          if (!targets[id]) delete posRef.current[id];
        }
        for (const l of d.lives) {
          const cur = posRef.current[l.id] ?? { x: l.x, y: l.y };
          const k = dt / 300; // 平滑系数
          cur.x = lerp(cur.x, l.x, k);
          cur.y = lerp(cur.y, l.y, k);
          posRef.current[l.id] = cur;
        }

        // 关系连线（高关系）
        for (const l of d.lives) {
          if (!l.importantRelations) continue;
          for (const r of l.importantRelations) {
            const other = d.lives.find((o) => o.id === r.lifeId);
            if (!other) continue;
            const a = posRef.current[l.id];
            const b = posRef.current[other.id];
            if (!a || !b) continue;
            ctx!.strokeStyle = `rgba(56,189,248,${0.12 + (r.value / 100) * 0.35})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x * W, a.y * H);
            ctx!.lineTo(b.x * W, b.y * H);
            ctx!.stroke();
          }
        }

        // 资源光点
        for (const res of d.resources) {
          const x = res.x * W;
          const y = res.y * H;
          const g = ctx!.createRadialGradient(x, y, 0, x, y, 10);
          g.addColorStop(0, 'rgba(251,191,36,0.9)');
          g.addColorStop(1, 'rgba(251,191,36,0)');
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, 10, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = '#fde68a';
          ctx!.beginPath();
          ctx!.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx!.fill();
        }

        // 生命（发光光斑）
        for (const l of d.lives) {
          const p = posRef.current[l.id];
          if (!p) continue;
          const x = p.x * W;
          const y = p.y * H;
          const size = sizeOf(l.id);
          const sleeping = l.state === 'sleeping';
          const dim = sleeping ? 0.25 : Math.max(0.35, Math.min(1, l.energy / 80));

          // 光晕
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, size * 2.6);
          glow.addColorStop(0, `${l.color}${Math.round(dim * 120).toString(16).padStart(2, '0')}`);
          glow.addColorStop(1, 'transparent');
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(x, y, size * 2.6, 0, Math.PI * 2);
          ctx!.fill();

          // 实心核
          ctx!.globalAlpha = dim;
          ctx!.fillStyle = l.color;
          ctx!.beginPath();
          ctx!.arc(x, y, size * 0.62, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = 1;

          // 名字
          ctx!.fillStyle = sleeping ? '#64748b' : '#cfeaf6';
          ctx!.font = '12px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.fillText(l.name, x, y - size - 6);

          if (sleeping) {
            ctx!.fillText('💤', x, y + 4);
          }
        }

        // 事件光点（上浮 + 淡出）
        const nowMs = now;
        fxRef.current = fxRef.current.filter((fx) => nowMs - fx.born < fx.life);
        for (const fx of fxRef.current) {
          const age = (nowMs - fx.born) / fx.life; // 0..1
          const x = fx.x * W;
          const y = fx.y * H - age * 46; // 上浮
          const alpha = 1 - age;
          // 光点
          const g = ctx!.createRadialGradient(x, y, 0, x, y, 16);
          g.addColorStop(0, `${fx.color}${Math.round(alpha * 200).toString(16).padStart(2, '0')}`);
          g.addColorStop(1, 'transparent');
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, 16, 0, Math.PI * 2);
          ctx!.fill();
          // 标签
          ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx!.font = '12px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.fillText(fx.label, x, y - 14);
        }
      } else {
        ctx!.fillStyle = '#64748b';
        ctx!.font = '18px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText('世界空着，等待生命进入…', W / 2, H / 2);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (!data) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '30vh' }}>《我的世界》加载中…</div>;
  }

  const active = data.lives.filter((l) => l.state === 'active').length;
  const sleeping = data.lives.length - active;
  const avgEnergy = data.lives.length ? Math.round(data.lives.reduce((s, l) => s + l.energy, 0) / data.lives.length) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 14, height: 'calc(100vh - 120px)' }}>
      {/* 左：世界状态 */}
      <div style={{ background: 'rgba(14,40,58,0.55)', border: '1px solid rgba(120,200,230,0.18)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, backdropFilter: 'blur(6px)' }}>
        <div style={{ fontSize: 13, color: '#7fa6b8', fontWeight: 700, letterSpacing: 2 }}>世界状态</div>
        <Stat label="轮次" value={`第 ${data.round} 轮`} />
        <Stat label="运行时间" value={`${Math.floor(data.simulationTime / 60)}:${String(Math.floor(data.simulationTime % 60)).padStart(2, '0')}`} />
        <Stat label="生命数" value={`${data.lives.length}`} />
        <Stat label="活跃" value={`${active}`} />
        <Stat label="休眠" value={`${sleeping}`} />
        <Stat label="平均能量" value={`${avgEnergy}`} />
        <Stat label="阶段" value={labelOf(data.status)} />
      </div>

      {/* 中：Canvas 世界 */}
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(120,200,230,0.18)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* 右：关键动态 */}
      <div style={{ background: 'rgba(14,40,58,0.55)', border: '1px solid rgba(120,200,230,0.18)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, backdropFilter: 'blur(6px)' }}>
        <div style={{ fontSize: 13, color: '#7fa6b8', fontWeight: 700, letterSpacing: 2 }}>世界正在发生</div>
        {data.keyEvents.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>还没有关键事件。</div>
        ) : (
          [...data.keyEvents].reverse().map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: '#cbd5e1', borderLeft: '2px solid #38bdf8', paddingLeft: 8 }}>
              {fmtTime(e.t)} · {e.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#5d7a8c' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#cfeaf6' }}>{value}</div>
    </div>
  );
}

function labelOf(status: string): string {
  const map: Record<string, string> = {
    creating: '创建阶段',
    running: '运行中',
    revising: '修改阶段',
    finished: '已结束',
  };
  return map[status] ?? status;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
