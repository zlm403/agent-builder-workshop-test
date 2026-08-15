'use client';
// =========================================================
// 《我的世界》大屏端：左侧世界状态 + 中央 Canvas 公共世界 + 右侧关键动态
// 渲染：生命 = 发光光斑（大小限范围，颜色=学生选择）；资源 = 金色光点；
//       事件 = 带 2 字标签的彩色光点（从发生位置飘出、上浮淡出）。
// 用 requestAnimationFrame 持续渲染，两次轮询间生命位置 lerp 插值，让移动平滑。
// 逻辑与数据全部来自 /api/world（引擎），本组件只负责视觉。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { findTip } from '@/lib/world/tips';

interface WorldLife {
  id: string;
  name: string;
  color: string;
  shape?: string;
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
const LIFE_SIZE_MIN = 14;
const LIFE_SIZE_MAX = 26;
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
  const [popup, setPopup] = useState<{ show: boolean; content: string | null }>({ show: false, content: null });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 渲染层状态（ref，不进 React 重渲染）
  const dataRef = useRef<WorldData | null>(null);
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  const fxRef = useRef<FxLight[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  // 环境光斑整体速度/亮度系数（教师调节，渲染循环读 ref）
  const visualRef = useRef<{ speed: number; brightness: number }>({ speed: 1, brightness: 1 });
  // SVG 形状缓存（lifeId -> Image），只加载一次
  const svgImgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // 环境光点（鱼缸 Light 风格：慢、亮、大、带拖尾与标签，纯视觉）
  const ambRef = useRef<{
    x: number; y: number; dirx: number; diry: number;
    baseSpeed: number; t: number; oscFreq: number;
    size: number; hue: number; label: string; life: number;
    trail: { x: number; y: number }[];
  }[]>([]);

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

  // 轮询弹窗
  useEffect(() => {
    let closed = false;
    async function loadPopup() {
      try {
        const r = await fetch('/api/world/popup', { cache: 'no-store' });
        const d = await r.json();
        if (!closed) setPopup({ show: !!d.show, content: d.content ?? null });
      } catch { /* noop */ }
    }
    loadPopup();
    const t = setInterval(loadPopup, 2000);
    return () => { closed = true; clearInterval(t); };
  }, []);

  // 轮询环境光斑速度/亮度
  useEffect(() => {
    let closed = false;
    async function loadVisual() {
      try {
        const r = await fetch('/api/world/visual', { cache: 'no-store' });
        const d = await r.json();
        if (!closed) visualRef.current = { speed: Number(d.speed) || 1, brightness: Number(d.brightness) || 1 };
      } catch { /* noop */ }
    }
    loadVisual();
    const t = setInterval(loadVisual, 2000);
    return () => { closed = true; clearInterval(t); };
  }, []);

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
      if (rect.width <= 0 || rect.height <= 0) return; // 未布局完成，跳过
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      // 首次初始化环境光点（鱼缸 Light 风格：大、亮、慢，带标签与拖尾）
      if (ambRef.current.length === 0) {
        const TYPES = [
          { label: '机遇', hue: 150 },
          { label: '变故', hue: 0 },
          { label: '惊喜', hue: 320 },
          { label: '考验', hue: 40 },
          { label: '风暴', hue: 265 },
          { label: '平静', hue: 200 },
          { label: '偶然', hue: 180 },
          { label: '礼物', hue: 340 },
        ];
        for (let i = 0; i < 14; i++) {
          const ang = Math.random() * Math.PI * 2;
          const type = TYPES[(Math.random() * TYPES.length) | 0];
          ambRef.current.push({
            x: Math.random(),
            y: Math.random(),
            dirx: Math.cos(ang),
            diry: Math.sin(ang),
            baseSpeed: 0.0001 + Math.random() * 0.00035, // 慢（归一化/ms），整体比之前再慢约 30%
            t: Math.random() * 1000,
            oscFreq: 0.003 + Math.random() * 0.012,
            size: 12 + Math.random() * 22, // 大：12-34px
            hue: type.hue,
            label: type.label,
            life: 600 + Math.random() * 600,
            trail: [],
          });
        }
      }
    }
    // 延迟到下一帧再量尺寸（组件刚挂载时 canvas 可能还没布局）
    requestAnimationFrame(() => requestAnimationFrame(resize));
    window.addEventListener('resize', resize);
    // 用 ResizeObserver 监听容器尺寸，确保 canvas 始终正确
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

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

      // 深海渐变背景（鱼缸多层渐变风格）
      const bg = ctx!.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a2233');
      bg.addColorStop(0.5, '#06202f');
      bg.addColorStop(1, '#031018');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);
      // 两团柔光，让深海底有层次
      const glow1 = ctx!.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.6);
      glow1.addColorStop(0, 'rgba(20,70,95,0.35)');
      glow1.addColorStop(1, 'transparent');
      ctx!.fillStyle = glow1;
      ctx!.fillRect(0, 0, W, H);
      const glow2 = ctx!.createRadialGradient(W * 0.8, H * 0.9, 0, W * 0.8, H * 0.9, W * 0.5);
      glow2.addColorStop(0, 'rgba(10,50,70,0.4)');
      glow2.addColorStop(1, 'transparent');
      ctx!.fillStyle = glow2;
      ctx!.fillRect(0, 0, W, H);

      // 环境光点（鱼缸 Light 风格：慢速起伏、拖尾光晕、带 2 字标签）
      const vis = visualRef.current;
      for (const a of ambRef.current) {
        a.t++;
        const speed = a.baseSpeed * (1 + 0.5 * Math.sin(a.t * a.oscFreq)) * vis.speed;
        a.x += a.dirx * speed * dt;
        a.y += a.diry * speed * dt;
        if (a.x < 0) { a.x = 0; a.dirx *= -1; }
        if (a.x > 1) { a.x = 1; a.dirx *= -1; }
        if (a.y < 0) { a.y = 0; a.diry *= -1; }
        if (a.y > 1) { a.y = 1; a.diry *= -1; }
        a.life--;
        a.trail.push({ x: a.x, y: a.y });
        if (a.trail.length > 14) a.trail.shift();
        if (a.life <= 0) { a.life = 600 + Math.random() * 600; }

        const gx = a.x * W;
        const gy = a.y * H;
        const al = Math.min(1, a.life / 120);
        ctx!.globalCompositeOperation = 'lighter';
        // 拖尾
        for (let i = 0; i < a.trail.length; i++) {
          const t = a.trail[i];
          const trailAlpha = (i / a.trail.length) * 0.28 * al * vis.brightness;
          ctx!.fillStyle = `hsla(${a.hue},90%,80%,${Math.min(1, trailAlpha)})`;
          ctx!.beginPath();
          ctx!.arc(t.x * W, t.y * H, a.size * (i / a.trail.length) * 0.6, 0, Math.PI * 2);
          ctx!.fill();
        }
        // 光晕
        const g = ctx!.createRadialGradient(gx, gy, 0, gx, gy, a.size * 2.2);
        g.addColorStop(0, `hsla(${a.hue},100%,92%,${Math.min(1, 0.9 * al * vis.brightness)})`);
        g.addColorStop(0.4, `hsla(${a.hue},95%,70%,${Math.min(1, 0.5 * al * vis.brightness)})`);
        g.addColorStop(1, 'transparent');
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(gx, gy, a.size * 2.2, 0, Math.PI * 2);
        ctx!.fill();
        // 标签（2 字，画在光点上方）
        ctx!.globalCompositeOperation = 'source-over';
        ctx!.fillStyle = `hsla(${a.hue},90%,78%,${Math.min(1, 0.9 * al * vis.brightness)})`;
        ctx!.font = '14px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(a.label, gx, gy - a.size * 2.2 - 8);
      }
      ctx!.globalCompositeOperation = 'source-over';

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

        // 生命（发光光斑 + AI 形状）
        for (const l of d.lives) {
          const p = posRef.current[l.id];
          if (!p) continue;
          const x = p.x * W;
          const y = p.y * H;
          const size = sizeOf(l.id);
          const sleeping = l.state === 'sleeping';
          const dim = sleeping ? 0.3 : Math.max(0.45, Math.min(1, l.energy / 80));

          ctx!.globalCompositeOperation = 'lighter';
          // 光晕（更大更亮）
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, size * 3);
          glow.addColorStop(0, `${l.color}${Math.round(dim * 200).toString(16).padStart(2, '0')}`);
          glow.addColorStop(0.5, `${l.color}${Math.round(dim * 90).toString(16).padStart(2, '0')}`);
          glow.addColorStop(1, 'transparent');
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(x, y, size * 3, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalCompositeOperation = 'source-over';

          // 实心核（底色，AI 形状在其上）
          ctx!.globalAlpha = dim;
          ctx!.fillStyle = l.color;
          ctx!.beginPath();
          ctx!.arc(x, y, size * 0.62, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = 1;

          // AI 形状（SVG → Image → drawImage），只在 active 时完整显示
          if (l.shape && !sleeping) {
            let img = svgImgRef.current.get(l.id);
            if (!img) {
              const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(l.shape);
              img = new Image();
              img.src = src;
              svgImgRef.current.set(l.id, img);
            }
            if (img && img.complete && img.naturalWidth > 0) {
              const s = size * 1.7;
              ctx!.globalAlpha = dim;
              ctx!.drawImage(img, x - s / 2, y - s / 2, s, s);
              ctx!.globalAlpha = 1;
            }
          }

          // 名字
          ctx!.fillStyle = sleeping ? '#64748b' : '#e2f4ff';
          ctx!.font = 'bold 14px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.fillText(l.name, x, y - size - 8);

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
          const y = fx.y * H - age * 60; // 上浮
          const alpha = 1 - age;
          // 光点（大而亮）
          ctx!.globalCompositeOperation = 'lighter';
          const g = ctx!.createRadialGradient(x, y, 0, x, y, 26);
          g.addColorStop(0, `${fx.color}${Math.round(alpha * 240).toString(16).padStart(2, '0')}`);
          g.addColorStop(0.5, `${fx.color}${Math.round(alpha * 120).toString(16).padStart(2, '0')}`);
          g.addColorStop(1, 'transparent');
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, 26, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalCompositeOperation = 'source-over';
          // 标签
          ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx!.font = 'bold 15px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.fillText(fx.label, x, y - 20);
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
      ro?.disconnect();
    };
  }, []);

  if (!data) {
    // data 未到：Canvas 照常挂载（渲染循环依赖 mount 时挂载的 canvas），左右栏显示占位
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 14, height: 'calc(100vh - 120px)' }}>
        <div style={{ background: 'rgba(14,40,58,0.55)', border: '1px solid rgba(120,200,230,0.18)', borderRadius: 14, padding: 16, color: '#7fa6b8' }}>
          世界状态
        </div>
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(120,200,230,0.18)' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <PopupOverlay show={popup.show} content={popup.content} />
        </div>
        <div style={{ background: 'rgba(14,40,58,0.55)', border: '1px solid rgba(120,200,230,0.18)', borderRadius: 14, padding: 16, color: '#7fa6b8' }}>
          世界正在发生
        </div>
      </div>
    );
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
        <PopupOverlay show={popup.show} content={popup.content} />
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

// =========================================================
// 大屏按需弹窗（老师控制）：覆盖在游戏主屏上，讲 Tips 任务 / 操作方法 / AI 创作方法
// =========================================================
function PopupOverlay({ show, content }: { show: boolean; content: string | null }) {
  if (!show) return null;

  const blocks: Record<string, { title: string; lines: string[] }> = {
    usage: {
      title: '手机怎么玩 · 三步',
      lines: [
        '① 连：你已经扫码进来了，手机跟着大屏走就行',
        '② 造：给它起名、选颜色，写一段「生命定义」——也可以用一句话告诉 AI，让 AI 帮你写',
        '③ 看：提交后它进入世界，看它怎么动；点「和 AI 聊聊」，把看到的告诉 AI，让它帮你分析',
      ],
    },
    method: {
      title: 'AI 创作方法 · 想法是你的，AI 帮你做',
      lines: [
        '先想：想清楚你的生命是什么性格，用大白话说出来',
        '再问：把想法发给 AI，让 AI 帮你把它写成「生命定义」',
        '后看：放进世界观察——它靠近谁、帮谁、躲谁',
        '再改：看到不对劲，把现象告诉 AI，让它帮你分析，再改一句话，下一轮看变化',
      ],
    },
  };

  const tip = findTip(content);
  const b = tip ? { title: tip.title, lines: tip.lines } : (blocks[content ?? ''] ?? blocks.usage);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,17,26,0.72)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        maxWidth: 720, width: '86%', padding: '34px 40px',
        background: 'linear-gradient(180deg,#0e2940,#081a2b)',
        border: '1px solid rgba(120,200,230,0.3)', borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#39d6ff', marginBottom: 18, letterSpacing: 1 }}>
          {b.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {b.lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: '#ffd27a', fontSize: 18, fontWeight: 800, lineHeight: 1.5 }}>{'·'}</span>
              <span style={{ fontSize: 21, lineHeight: 1.5, color: '#cfeaf6' }}>{line}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, fontSize: 14, color: '#7fa6b8', textAlign: 'center' }}>
          讲完后由老师收起本窗，游戏继续
        </div>
      </div>
    </div>
  );
}
