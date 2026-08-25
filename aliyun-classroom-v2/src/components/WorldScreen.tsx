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
import { api } from '@/lib/basePath';
import type { LifeSpec, SpecAction } from '@/lib/world/spec';
import { sanitizeSvg } from '@/lib/world/spec';

interface WorldLife {
  id: string;
  name: string;
  color: string;
  shape?: string;
  spec?: LifeSpec;
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
  targetId?: string;
  type?: string;
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
  kind: 'light' | 'label' | 'spark' | 'link' | 'ring' | 'mini' | 'float' | 'orbit';
  x: number; // 0..1 世界坐标
  y: number;
  tx?: number; // 目标世界坐标（link/ring/orbit 圆心）
  ty?: number;
  img?: HTMLImageElement | null; // emitSelf/miniSelf 草图粒子贴图
  vx?: number; // 粒子方向（spark/mini/float）
  vy?: number;
  size?: number;
  label: string;
  color: string;
  born: number; // 出生时间戳
  life: number; // 存活 ms
}

// 生命持续状态效果（scale/dim/glow 等，随时间恢复）
interface LifeFxState {
  scale: number; // 当前缩放倍数
  dimUntil: number; // 变暗截止 ms
  glowUntil: number; // 发光截止 ms
  flickerUntil: number; // 闪光截止 ms
}

// 生命大小范围（世界坐标归一化后的像素基准在 draw 里换算）
const LIFE_SIZE_MIN = 14;
const LIFE_SIZE_MAX = 26;
const FX_LIFE = 1800; // 事件光点存活 1.8s
const SPEC_FX_LIFE = 1600; // 表现规格效果的存活时长

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
  const [renderErr, setRenderErr] = useState<string | null>(null); // draw 异常（显示排查用）
  const [canvasSize, setCanvasSize] = useState<string>(''); // canvas 尺寸（显示排查用）
  const [drawCount, setDrawCount] = useState(0); // draw 帧计数（确认渲染循环是否在跑）
  const drawCountRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 渲染层状态（ref，不进 React 重渲染）
  const dataRef = useRef<WorldData | null>(null);
  const posRef = useRef<Record<string, { x: number; y: number; hit: number }>>({});
  const fxRef = useRef<FxLight[]>([]);
  const fxStateRef = useRef<Record<string, LifeFxState>>({});
  const seenRef = useRef<Set<string>>(new Set());
  const lastHitFxRef = useRef<Record<string, number>>({});
  // 环境光斑整体速度/亮度系数（教师调节，渲染循环读 ref）
  const visualRef = useRef<{ speed: number; brightness: number }>({ speed: 1, brightness: 1 });
  // SVG 形状缓存（lifeId -> Image），只加载一次
  const svgImgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // AI 生成的自包含 SVG 表现动画（DOM overlay，覆盖在 canvas 上播放一次）
  const [svgOverlays, setSvgOverlays] = useState<{ id: string; x: number; y: number; svg: string }[]>([]);
  // 把 AI 生成的 SVG 表现放到生命所在坐标播放（再过滤一次防 XSS）
  function playSvgFx(life: WorldLife, svg: string): void {
    const clean = sanitizeSvg(svg);
    if (!clean) return;
    const id = `${life.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSvgOverlays((prev) => [...prev, { id, x: life.x, y: life.y, svg: clean }]);
  }
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
        const r = await fetch(api(`/api/world?view=screen&sessionId=${sessionId}`));
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
        const r = await fetch(api('/api/world/popup'), { cache: 'no-store' });
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
        const r = await fetch(api('/api/world/visual'), { cache: 'no-store' });
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

    // mount 时无条件初始化环境光点（不依赖 canvas 尺寸，保证光点一定存在）
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
          baseSpeed: 0.0001 + Math.random() * 0.00035,
          t: Math.random() * 1000,
          oscFreq: 0.003 + Math.random() * 0.012,
          size: 12 + Math.random() * 22,
          hue: type.hue,
          label: type.label,
          life: 600 + Math.random() * 600,
          trail: [],
        });
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      let w = rect.width;
      let h = rect.height;
      if (w <= 0 || h <= 0) {
        // canvas 尺寸为 0 时用父容器兜底
        const parent = canvas!.parentElement?.getBoundingClientRect();
        if (parent) { w = parent.width; h = parent.height; }
      }
      if (w <= 0 || h <= 0) return; // 仍无尺寸，下次再试
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      try { setCanvasSize(`${Math.round(w)}×${Math.round(h)}`); } catch {}
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

    // ===================== 通用表现执行器（读 LifeSpec，调能力库） =====================

    function fxState(id: string): LifeFxState {
      let s = fxStateRef.current[id];
      if (!s) {
        s = { scale: 1, dimUntil: 0, glowUntil: 0, flickerUntil: 0 };
        fxStateRef.current[id] = s;
      }
      return s;
    }

    function setFxState(id: string, patch: Partial<LifeFxState>, now: number): void {
      const s = fxState(id);
      if (patch.scale !== undefined) s.scale = patch.scale;
      if (patch.dimUntil !== undefined) s.dimUntil = now + patch.dimUntil;
      if (patch.glowUntil !== undefined) s.glowUntil = now + patch.glowUntil;
      if (patch.flickerUntil !== undefined) s.flickerUntil = now + patch.flickerUntil;
    }

    // 事件 type → LifeSpec 字段
    const SPEC_FIELD: Record<string, keyof LifeSpec> = {
      meet: 'onMeet',
      help: 'onWave',
      resource: 'onResource',
      hit: 'onHit',
      grow: 'onGrow',
      death: 'onDeath',
    };

    // 从生命的 shape（SVG）拿贴图；未加载好返回 null（调用方用颜色圆点兜底）
    function sketchImg(life: WorldLife): HTMLImageElement | null {
      if (!life.shape) return null;
      let img = svgImgRef.current.get(life.id);
      if (!img) {
        const src = 'data:image/svg+xml;base64,' + toBase64(life.shape);
        img = new Image();
        img.onload = () => {};
        img.src = src;
        svgImgRef.current.set(life.id, img);
      }
      if (img.complete && img.naturalWidth > 0) return img;
      return null;
    }

    // 发射学员草图的粒子（小星星）：从源位置飞向目标位置
    function spawnSpark(life: WorldLife, px: number, py: number, tx: number, ty: number, n: number, now: number, mini: boolean): void {
      const img = sketchImg(life);
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(ty - py, tx - px) + (Math.random() - 0.5) * 0.8;
        const spd = 0.002 + Math.random() * 0.003;
        fxRef.current.push({
          kind: mini ? 'mini' : 'spark',
          x: px,
          y: py,
          tx,
          ty,
          img,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: mini ? 0.05 : 0.028 + Math.random() * 0.014,
          label: '',
          color: life.color,
          born: now + i * 40,
          life: 900 + Math.random() * 400,
        });
      }
    }

    // 光带连线：从 A 到 B 的光带，短暂存在
    function spawnLink(x1: number, y1: number, x2: number, y2: number, color: string, now: number): void {
      fxRef.current.push({
        kind: 'link', x: x1, y: y1, tx: x2, ty: y2,
        label: '', color, born: now, life: SPEC_FX_LIFE,
      });
    }

    // 扩散圆环（抖动/转圈/靠近/躲开的通用视觉）
    function spawnRing(x: number, y: number, color: string, now: number): void {
      fxRef.current.push({
        kind: 'ring', x, y, label: '', color, born: now, life: 900,
      });
    }

    // 飞出一个缩小版自己（草图）
    function spawnMini(life: WorldLife, px: number, py: number, tx: number, ty: number, now: number): void {
      spawnSpark(life, px, py, tx, ty, 1, now, true);
    }

    // 冒泡（向上飘的小气泡）
    function spawnFloatBubbles(x: number, y: number, color: string, now: number): void {
      for (let i = 0; i < 4; i++) {
        fxRef.current.push({
          kind: 'float', x: x + (Math.random() - 0.5) * 0.06, y,
          vx: (Math.random() - 0.5) * 0.001, vy: -0.0018 - Math.random() * 0.0006,
          size: 0.02 + Math.random() * 0.016,
          label: '', color: '#bfe8ff', born: now + i * 60, life: 900,
        });
      }
    }

    // 掉泪（小泪滴向下）
    function spawnCry(x: number, y: number, color: string, now: number): void {
      for (let i = 0; i < 3; i++) {
        fxRef.current.push({
          kind: 'float', x: x + (Math.random() - 0.5) * 0.04, y,
          vx: 0, vy: 0.0016 + Math.random() * 0.0004,
          size: 0.018, label: '', color: '#7dd3fc', born: now + i * 60, life: 900,
        });
      }
    }

    // 飘散（绕一圈淡出的光尘）
    function spawnFade(x: number, y: number, color: string, now: number): void {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        fxRef.current.push({
          kind: 'spark', x, y,
          vx: Math.cos(ang) * 0.002, vy: Math.sin(ang) * 0.002,
          size: 0.02, label: '', color, born: now, life: 1100,
        });
      }
    }

    // 绕行：围绕目标画一小段弧线光点
    function spawnOrbit(px: number, py: number, tx: number, ty: number, color: string, now: number): void {
      fxRef.current.push({
        kind: 'orbit', x: tx, y: ty, tx: px, ty: py,
        label: '', color, born: now, life: 1000,
      });
    }

    // 播放单个动作
    function playAction(life: WorldLife, target: WorldLife | undefined, act: SpecAction, now: number): void {
      const src = posRef.current[life.id];
      const px = src?.x ?? life.x;
      const py = src?.y ?? life.y;
      const color = life.color;
      const tgt = target && posRef.current[target.id] ? posRef.current[target.id] : undefined;
      const tX = tgt?.x ?? px;
      const tY = tgt?.y ?? py;
      const doName = (act as { do: string }).do;
      switch (doName) {
        case 'emitSelf': {
          const n = (act as { n?: number }).n ?? 3;
          const to = (act as { to?: string }).to;
          spawnSpark(life, px, py, to === 'other' ? tX : px, to === 'other' ? tY : py, n, now, false);
          break;
        }
        case 'lightLink':
          spawnLink(px, py, tX, tY, color, now);
          break;
        case 'miniSelf':
          spawnMini(life, px, py, tX, tY, now);
          break;
        case 'scale':
          setFxState(life.id, { scale: (act as { value?: number }).value ?? 1.3 }, now);
          break;
        case 'dim':
          setFxState(life.id, { dimUntil: SPEC_FX_LIFE }, now);
          break;
        case 'glow':
          setFxState(life.id, { glowUntil: SPEC_FX_LIFE }, now);
          break;
        case 'flash':
          setFxState(life.id, { flickerUntil: SPEC_FX_LIFE }, now);
          break;
        case 'jitter':
          spawnRing(px, py, color, now);
          break;
        case 'bubble':
          spawnFloatBubbles(px, py, color, now);
          break;
        case 'cry':
          spawnCry(px, py, color, now);
          break;
        case 'dance':
          spawnRing(px, py, color, now);
          spawnRing(px, py, '#fbbf24', now + 120);
          break;
        case 'fade':
          spawnFade(px, py, color, now);
          break;
        case 'orbit':
          spawnOrbit(px, py, tX, tY, color, now);
          break;
        case 'nuzzle':
          spawnLink(px, py, tX, tY, color, now);
          spawnRing(tX, tY, '#ffffff', now);
          break;
        case 'approach':
        case 'avoid':
          spawnRing(px, py, doName === 'approach' ? '#38bdf8' : '#c77dff', now);
          break;
        case 'svg':
          // AI 直接生成的「自包含 SVG 动画」表现：想什么画什么，通用渲染器播放
          playSvgFx(life, (act as { svg?: string }).svg || '');
          break;
        default:
          fxRef.current.push({ kind: 'label', x: px, y: py, label: doName, color, born: now, life: SPEC_FX_LIFE });
      }
    }

    // 播放某生命某事件的完整规格；返回是否真的播放了（有动作）
    function applyEventSpec(life: WorldLife, target: WorldLife | undefined, type: string, now: number): boolean {
      const field = SPEC_FIELD[type];
      const spec = life.spec;
      const acts = field && spec ? (spec[field] as SpecAction[] | undefined) : undefined;
      if (!acts || acts.length === 0) return false;
      for (const a of acts) playAction(life, target, a, now);
      return true;
    }

    function draw(now: number) {
      try {
      const dt = Math.min(100, now - last);
      last = now;
      drawCountRef.current++;
      if (drawCountRef.current % 30 === 0) {
        try { setDrawCount(drawCountRef.current); } catch {}
      }
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let W = rect.width;
      let H = rect.height;
      if (W <= 0 || H <= 0) {
        // 尺寸未就绪：先 resize（设 canvas.width/height），下一帧再画
        resize();
        // 用 canvas 实际像素尺寸兜底画背景（保证不是纯黑空框）
        W = canvas!.width / dpr;
        H = canvas!.height / dpr;
        if (W <= 0 || H <= 0) return;
      }
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
        // 收集新事件 → 通用执行器（读 spec 播放）或兜底标签
        for (const e of d.keyEvents) {
          const key = `${e.t}-${e.text}`;
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          const src = e.lifeId ? d.lives.find((l) => l.id === e.lifeId) : undefined;
          const tgt = e.targetId ? d.lives.find((l) => l.id === e.targetId) : undefined;
          const played = src && e.type ? applyEventSpec(src, tgt, e.type, now) : false;
          if (!played) {
            const fx = fxForEvent(e.text);
            if (fx && e.lifeId) {
              const srcL = d.lives.find((l) => l.id === e.lifeId);
              fxRef.current.push({
                kind: 'label',
                x: srcL?.x ?? 0.5,
                y: srcL?.y ?? 0.5,
                label: fx.label,
                color: fx.color,
                born: now,
                life: FX_LIFE,
              });
            }
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
          const cur = posRef.current[l.id] ?? { x: l.x, y: l.y, hit: 0 };
          const k = dt / 300; // 平滑系数
          cur.x = lerp(cur.x, l.x, k);
          cur.y = lerp(cur.y, l.y, k);
          cur.hit = Math.max(0, (cur.hit || 0) - dt / 400); // 受击闪光随时间衰减
          posRef.current[l.id] = cur;
        }

        // 碰撞检测：环境光点撞到生命 → 触发受击闪光（纯前端，归一化坐标）
        // 光点实际显示半径 ≈ a.size*2.2 px；生命半径 ≈ sEff px；换算成归一化距离
        const px2u = 1 / Math.max(W, H); // 1px = 多少归一化单位
        for (const a of ambRef.current) {
          const aR = a.size * 2.2 * px2u * 2; // 光点有效碰撞半径（归一化）
          for (const l of d.lives) {
            const p = posRef.current[l.id];
            if (!p) continue;
            const dx = a.x - p.x;
            const dy = a.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const lR = sizeOf(l.id) * (1 + (p.hit || 0) * 0.35) * px2u * 2.2;
            if (dist < aR + lR) {
              const prev = p.hit || 0;
              p.hit = Math.min(1, prev + 0.5);
              if (prev < 0.3 && now - (lastHitFxRef.current[l.id] ?? 0) > 900) {
                lastHitFxRef.current[l.id] = now;
                applyEventSpec(l, undefined, 'hit', now);
              }
            }
          }
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
          const st = fxState(l.id);
          // 持续状态：缩放 / 变暗 / 发光 / 闪光（随时间恢复）
          if (st.scale !== 1) {
            st.scale = st.scale > 1 ? Math.max(1, st.scale - dt / 1600) : Math.min(1, st.scale + dt / 1600);
          }
          const dimNow = st.dimUntil > now;
          const glowNow = st.glowUntil > now;
          const flickerNow = st.flickerUntil > now;
          const flickerDim = flickerNow && Math.floor(now / 90) % 2 === 0;
          const size = sizeOf(l.id) * st.scale;
          const sleeping = l.state === 'sleeping';
          // 受击闪光：hit>0 时放大 + 变亮（碰撞反应）
          const hit = p.hit || 0;
          const hitScale = 1 + hit * 0.35;
          const dim = (sleeping ? 0.3 : Math.max(0.45, Math.min(1, l.energy / 80))) * (1 + hit * 0.6)
            * (dimNow || flickerDim ? 0.45 : 1);
          const glowBoost = glowNow ? 1.6 : 1;
          const sEff = size * hitScale;

          ctx!.globalCompositeOperation = 'lighter';
          // 光晕（更大更亮；glow 状态加强）
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, sEff * 3 * glowBoost);
          glow.addColorStop(0, `${l.color}${Math.round(dim * 200).toString(16).padStart(2, '0')}`);
          glow.addColorStop(0.5, `${l.color}${Math.round(dim * 90).toString(16).padStart(2, '0')}`);
          glow.addColorStop(1, 'transparent');
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(x, y, sEff * 3 * glowBoost, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalCompositeOperation = 'source-over';

          // 实心核（底色，AI 形状在其上）
          ctx!.globalAlpha = dim;
          ctx!.fillStyle = l.color;
          ctx!.beginPath();
          ctx!.arc(x, y, sEff * 0.62, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = 1;

          // AI 形状（SVG → Image → drawImage），只在 active 时完整显示；任何异常回退圆斑
          if (l.shape && !sleeping) {
            try {
              let img = svgImgRef.current.get(l.id);
              if (!img) {
                const src = 'data:image/svg+xml;base64,' + toBase64(l.shape);
                img = new Image();
                img.onload = () => { /* 加载完成，下一帧会画出来 */ };
                img.src = src;
                svgImgRef.current.set(l.id, img);
              }
              if (img && img.complete && img.naturalWidth > 0) {
                const s = sEff * 1.7;
                ctx!.globalAlpha = dim;
                ctx!.drawImage(img, x - s / 2, y - s / 2, s, s);
                ctx!.globalAlpha = 1;
              }
            } catch (e) {
              /* SVG 解析失败，保持圆斑，不中断渲染 */
            }
          }

          // 名字
          ctx!.fillStyle = sleeping ? '#64748b' : '#e2f4ff';
          ctx!.font = 'bold 14px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.fillText(l.name, x, y - sEff - 8);

          if (sleeping) {
            ctx!.fillText('💤', x, y + 4);
          }
        }

        // 事件 FX 渲染（按 kind 分发）
        const nowMs = now;
        fxRef.current = fxRef.current.filter((fx) => nowMs - fx.born < fx.life);
        for (const fx of fxRef.current) {
          const age = (nowMs - fx.born) / fx.life; // 0..1
          const alpha = 1 - age;
          const fadeIn = Math.min(1, age * 5);
          const ox = fx.x * W;
          const oy = fx.y * H;

          if (fx.kind === 'spark' || fx.kind === 'mini') {
            // 粒子：沿 vx/vy 方向飞，草图贴图或颜色圆点
            const px = (fx.x + fx.vx! * (nowMs - fx.born) * 0.4) * W;
            const py = (fx.y + fx.vy! * (nowMs - fx.born) * 0.4) * H;
            const s = (fx.size ?? 0.03) * W * (0.6 + (1 - age) * 0.4);
            ctx!.globalCompositeOperation = 'lighter';
            if (fx.img) {
              ctx!.globalAlpha = alpha;
              ctx!.drawImage(fx.img, px - s / 2, py - s / 2, s, s);
              ctx!.globalAlpha = 1;
            } else {
              const g = ctx!.createRadialGradient(px, py, 0, px, py, s);
              g.addColorStop(0, `${fx.color}${Math.round(alpha * 230).toString(16).padStart(2, '0')}`);
              g.addColorStop(1, 'transparent');
              ctx!.fillStyle = g;
              ctx!.beginPath();
              ctx!.arc(px, py, s, 0, Math.PI * 2);
              ctx!.fill();
            }
            ctx!.globalCompositeOperation = 'source-over';
            continue;
          }

          if (fx.kind === 'link') {
            // 光带连线：A→B 的发光渐变线，从中间脉冲散开
            const ax = fx.x * W;
            const ay = fx.y * H;
            const bx = (fx.tx ?? fx.x) * W;
            const by = (fx.ty ?? fx.y) * H;
            const pulse = Math.sin(age * Math.PI);
            const c = ctx!.createLinearGradient(ax, ay, bx, by);
            c.addColorStop(0, `${fx.color}00`);
            c.addColorStop(0.5, `${fx.color}${Math.round(alpha * 200).toString(16).padStart(2, '0')}`);
            c.addColorStop(1, `${fx.color}00`);
            ctx!.strokeStyle = c;
            ctx!.lineWidth = 2.5 + pulse * 1.5;
            ctx!.beginPath();
            ctx!.moveTo(ax, ay);
            // 微微弯曲的光带
            const mx = (ax + bx) / 2 + (by - ay) * 0.18;
            const my = (ay + by) / 2 - (bx - ax) * 0.18;
            ctx!.quadraticCurveTo(mx, my, bx, by);
            ctx!.stroke();
            continue;
          }

          if (fx.kind === 'ring') {
            // 扩散圆环
            const r = (age * 60 + 6) * (W / 100);
            ctx!.globalCompositeOperation = 'lighter';
            ctx!.strokeStyle = `${fx.color}${Math.round(alpha * 180).toString(16).padStart(2, '0')}`;
            ctx!.lineWidth = 2.5;
            ctx!.beginPath();
            ctx!.arc(ox, oy - age * 20, r, 0, Math.PI * 2);
            ctx!.stroke();
            ctx!.globalCompositeOperation = 'source-over';
            continue;
          }

          if (fx.kind === 'float') {
            // 上浮/下沉的小泡（bubble/cry）
            const px = (fx.x + (fx.vx ?? 0) * (nowMs - fx.born) * 0.4) * W;
            const py = (fx.y + (fx.vy ?? 0) * (nowMs - fx.born) * 0.4) * H;
            const s = (fx.size ?? 0.02) * W;
            ctx!.globalCompositeOperation = 'lighter';
            ctx!.fillStyle = `${fx.color}${Math.round(alpha * 200).toString(16).padStart(2, '0')}`;
            ctx!.beginPath();
            ctx!.arc(px, py, s, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.globalCompositeOperation = 'source-over';
            continue;
          }

          if (fx.kind === 'orbit') {
            // 绕目标转圈的光点
            const cx = (fx.x) * W;
            const cy = (fx.y) * H;
            const ang = age * Math.PI * 2;
            const r = (fx.size ?? 0.04) * W * (1 + age);
            const px = cx + Math.cos(ang) * r;
            const py = cy + Math.sin(ang) * r * 0.6;
            ctx!.globalCompositeOperation = 'lighter';
            ctx!.fillStyle = `${fx.color}${Math.round(alpha * 220).toString(16).padStart(2, '0')}`;
            ctx!.beginPath();
            ctx!.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.globalCompositeOperation = 'source-over';
            continue;
          }

          // label：光点 + 上浮标签（兜底）
          const x = ox;
          const y = oy - age * 60;
          ctx!.globalCompositeOperation = 'lighter';
          const g = ctx!.createRadialGradient(x, y, 0, x, y, 26);
          g.addColorStop(0, `${fx.color}${Math.round(alpha * 240 * fadeIn).toString(16).padStart(2, '0')}`);
          g.addColorStop(0.5, `${fx.color}${Math.round(alpha * 120 * fadeIn).toString(16).padStart(2, '0')}`);
          g.addColorStop(1, 'transparent');
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, 26, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalCompositeOperation = 'source-over';
          if (fx.label) {
            ctx!.fillStyle = `rgba(255,255,255,${alpha * fadeIn})`;
            ctx!.font = 'bold 15px sans-serif';
            ctx!.textAlign = 'center';
            ctx!.fillText(fx.label, x, y - 20);
          }
        }
      } else {
        ctx!.fillStyle = '#64748b';
        ctx!.font = '18px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText('世界空着，等待生命进入…', W / 2, H / 2);
      }

      } catch (e) {
        // 任何一帧绘制异常都不中断动画循环；显示错误便于排查
        try { setRenderErr(String((e as Error)?.message || e)); } catch {}
      } finally {
        raf = requestAnimationFrame(draw);
      }
    }
    // 启动渲染循环（57e9b35 修"动画停下来"时误删了首次启动调用，
    // 只留下 draw 内部自我续命，导致 draw 从未执行、画布全空）
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
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(120,200,230,0.18)', minHeight: 300 }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
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
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(120,200,230,0.15)', fontSize: 11, color: '#5d7a8c', whiteSpace: 'pre-wrap' }}>
          <div>canvas: {canvasSize || '未就绪'}</div>
          <div>光点: {ambRef.current.length}</div>
          <div>draw帧: {drawCount || '未启动'}</div>
          {renderErr && <div style={{ color: '#f87171' }}>渲染异常: {renderErr}</div>}
        </div>
      </div>

      {/* 中：Canvas 世界 */}
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(120,200,230,0.18)', minHeight: 300 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        {svgOverlays.map((o) => (
          <SvgFx
            key={o.id}
            x={o.x}
            y={o.y}
            svg={o.svg}
            onEnd={() => setSvgOverlays((prev) => prev.filter((p) => p.id !== o.id))}
          />
        ))}
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

// UTF-8 安全地转 base64（SVG 可能含中文，不用废弃的 unescape）
function toBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  } catch {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
  }
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

// AI 生成的 SVG 表现动画：定位到生命世界坐标，播放一次后由父组件移除
function SvgFx({ x, y, svg, onEnd }: { x: number; y: number; svg: string; onEnd: () => void }) {
  useEffect(() => {
    const t = setTimeout(onEnd, 1700);
    return () => clearTimeout(t);
  }, [onEnd]);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: 180,
        height: 180,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 6,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
