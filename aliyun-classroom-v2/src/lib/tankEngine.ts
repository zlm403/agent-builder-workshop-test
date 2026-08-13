// =========================================================
// 共生缸 · Canvas 渲染引擎（纯函数，无 React 依赖）
// 由大屏 Tank 组件 + 小屏 LabTank 组件共用。
// 沿用了鱼缸引擎的 Person（粒子团生命）/ Light（事件光束）/ loop（主循环）。
// 把"人生属性"换成"生命规则"：trait / hue / movement / interaction / ability / cost
// =========================================================

export interface LifeDesign {
  trait?: string;        // 核心特质
  hue?: number;          // 主色
  movement?: string;     // 移动：explore | observe | follow-light | avoid-crowd | approach-lonely | edge
  interaction?: string;  // 相遇：approach | keep-distance | orbit | follow | exchange | change-color | pulse
  ability?: string;      // 能力：light-up | heal | repel-danger | connect | reveal-hidden | leave-light | mimic | custom
  cost?: string;         // 代价：dim | slow | stop | drain | single | cooldown | attract-events | custom
  shape?: string;        // 外形：circle | star | drop | shard | ring | custom
  trail?: string;        // 轨迹：none | glow | ripple | tail | sparkle
  custom?: string[];     // 自定义规则（自由添加）
}

export interface TankLife {
  id: string;
  name: string;
  trait: string;
  design: LifeDesign;
  // 运行时状态
  x: number; y: number;
  vx: number; vy: number;
  hue: number;
  energy: number;        // 0-100
  maxEnergy: number;
  flash: number;
  scale: number;
  cooldown: number;      // 能力冷却
  interactCount: number;
  particles: { a: number; r: number; x: number; y: number; vx: number; vy: number }[];
}

export interface TankEvent {
  x: number; y: number;
  dirx: number; diry: number;
  baseSpeed: number; speed: number;
  t: number; oscFreq: number;
  label: string; hue: number;
  size: number; life: number; maxLife: number;
  trail: { x: number; y: number }[];
}

export const EVENT_TYPES = [
  { label: '机遇', hue: 150 },
  { label: '变故', hue: 0 },
  { label: '惊喜', hue: 320 },
  { label: '考验', hue: 40 },
  { label: '风暴', hue: 265 },
  { label: '平静', hue: 200 },
  { label: '偶然', hue: 180 },
  { label: '礼物', hue: 340 },
];

// 创建生命（根据设计）
export function createLife(id: string, name: string, trait: string, design: LifeDesign, W: number, H: number, hueSeed: number): TankLife {
  const hue = design.hue ?? ((hueSeed + Math.random() * 60) % 360);
  const life: TankLife = {
    id, name, trait, design,
    x: W * 0.2 + Math.random() * W * 0.6,
    y: H * 0.2 + Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    hue,
    energy: 100, maxEnergy: 100,
    flash: 0, scale: 1, cooldown: 0,
    interactCount: 0,
    particles: [],
  };
  // 粒子团（形状）
  const n = 60;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 26;
    life.particles.push({ a, r, x: life.x + Math.cos(a) * r, y: life.y + Math.sin(a) * r, vx: 0, vy: 0 });
  }
  return life;
}

export function lifeRadius(life: TankLife): number {
  return (26 + life.energy * 0.06) * life.scale;
}

function moveFor(life: TankLife, movement: string): { vx: number; vy: number } {
  switch (movement) {
    case 'explore': return { vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8 };
    case 'observe': return { vx: life.vx * 0.92, vy: life.vy * 0.92 };
    case 'follow-light': return { vx: life.vx, vy: life.vy };
    case 'avoid-crowd': return { vx: life.vx, vy: life.vy };
    case 'approach-lonely': return { vx: life.vx, vy: life.vy };
    case 'edge': return { vx: life.vx, vy: life.vy };
    default: return { vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 };
  }
}

export function updateLife(life: TankLife, others: TankLife[], events: TankEvent[], W: number, H: number, dt: number) {
  const m = lifeRadius(life) + 6;
  // 移动规则
  const mv = moveFor(life, life.design.movement ?? 'explore');
  // 碰撞推挤（生命之间）
  for (const o of others) {
    if (o.id === life.id) continue;
    const dx = life.x - o.x, dy = life.y - o.y;
    const d = Math.hypot(dx, dy) + 0.001;
    const nx = dx / d, ny = dy / d;
    const rep = 0.5 / (d * d) * 600;
    life.vx += nx * rep * dt;
    life.vy += ny * rep * dt;
  }
  // 跟随光（follow-light）
  if (life.design.movement === 'follow-light') {
    let near: TankEvent | null = null, nd = 1e9;
    for (const L of events) { const d = Math.hypot(L.x - life.x, L.y - life.y); if (d < nd) { nd = d; near = L; } }
    if (near && nd < 200) { life.vx += (near.x - life.x) / nd * 0.05; life.vy += (near.y - life.y) / nd * 0.05; }
  }
  // 主动靠近孤单生命（approach-lonely）
  if (life.design.movement === 'approach-lonely') {
    let loner: TankLife | null = null, minInter = 1e9;
    for (const o of others) { if (o.id === life.id) continue; if (o.interactCount < minInter) { minInter = o.interactCount; loner = o; } }
    if (loner) { const dx = loner.x - life.x, dy = loner.y - life.y; const d = Math.hypot(dx, dy) + 0.001; life.vx += dx / d * 0.04; life.vy += dy / d * 0.04; }
  }
  // 贴边（edge）
  if (life.design.movement === 'edge') {
    life.vx *= 0.98; life.vy *= 0.98;
    if (life.y < H * 0.3) life.vy += 0.02;
    if (life.y > H * 0.9) life.vy -= 0.02;
    life.vx = Math.max(-0.3, Math.min(0.3, life.vx + (Math.random() - 0.5) * 0.02));
  }
  life.x += life.vx; life.y += life.vy;
  life.vx *= 0.985; life.vy *= 0.985;
  // 边界反弹
  if (life.x < m) { life.x = m; life.vx = Math.abs(life.vx); }
  if (life.x > W - m) { life.x = W - m; life.vx = -Math.abs(life.vx); }
  if (life.y < m) { life.y = m; life.vy = Math.abs(life.vy); }
  if (life.y > H - m) { life.y = H - m; life.vy = -Math.abs(life.vy); }
  // 粒子跟随
  const k = 0.02, damp = 0.86;
  for (const p of life.particles) {
    const tx = life.x + Math.cos(p.a) * p.r * life.scale;
    const ty = life.y + Math.sin(p.a) * p.r * life.scale;
    p.vx += (tx - p.x) * k; p.vy += (ty - p.y) * k;
    p.vx *= damp; p.vy *= damp; p.x += p.vx; p.y += p.vy;
  }
  life.flash *= 0.94; life.scale += (1 - life.scale) * 0.04;
  if (life.cooldown > 0) life.cooldown--;
  // 能量缓慢回（消耗后）
  if (life.energy < life.maxEnergy) life.energy = Math.min(life.maxEnergy, life.energy + 0.02);
}

// 事件撞击生命（撞后效果，按能力/代价规则）
export function hitLife(life: TankLife, ev: TankEvent, strength: number) {
  const impact = strength * (0.8 + (100 - life.energy) * 0.002);
  for (const p of life.particles) {
    const dx = p.x - ev.x, dy = p.y - ev.y; const d = Math.hypot(dx, dy) + 0.001;
    const f = impact * Math.max(0, 1 - d / (ev.size + lifeRadius(life)));
    p.vx += dx / d * f; p.vy += dy / d * f;
  }
  life.flash = Math.min(1, life.flash + strength * 0.06);
  // 能力触发
  const ab = life.design.ability;
  const cost = life.design.cost;
  if (life.cooldown <= 0 && ab && ab !== 'none') {
    if (ab === 'light-up') { life.energy = Math.min(life.maxEnergy, life.energy + 8); ev.life -= 10; }
    if (ab === 'heal') { life.energy = Math.min(life.maxEnergy, life.energy + 5); }
    if (ab === 'repel-danger') { ev.dirx = -ev.dirx; ev.diry = -ev.diry; }
    // 代价
    if (cost === 'dim') life.energy = Math.max(0, life.energy - 10);
    if (cost === 'slow') { life.vx *= 0.5; life.vy *= 0.5; }
    if (cost === 'drain') life.energy = Math.max(0, life.energy - 15);
    if (cost === 'cooldown') life.cooldown = 120;
    if (cost === 'attract-events') { /* 更容易被撞：下一事件概率提升由外层处理 */ }
    life.cooldown = Math.max(life.cooldown, 30);
  }
  life.interactCount++;
}

// 绘制生命（粒子团 + 光环 + 名字）
export function drawLife(ctx: CanvasRenderingContext2D, life: TankLife) {
  const sat = 35 + life.energy * 0.5;
  const light = 55 + life.flash * 25;
  // 能力光环（柔和）
  ctx.beginPath();
  ctx.arc(life.x, life.y, lifeRadius(life) + 10, 0, 7);
  ctx.strokeStyle = `hsla(${life.hue},80%,65%,${0.12})`;
  ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of life.particles) {
    ctx.fillStyle = `hsla(${life.hue},${sat}%,${light}%,${0.5 + life.flash * 0.5})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // 能量条（小）
  if (life.energy < 60) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(life.x - 16, life.y + lifeRadius(life) + 10, 32, 4);
    ctx.fillStyle = life.energy < 30 ? '#f87171' : '#fde047';
    ctx.fillRect(life.x - 16, life.y + lifeRadius(life) + 10, 32 * life.energy / 100, 4);
  }
  ctx.fillStyle = 'rgba(207,234,246,.75)';
  ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(life.name, life.x, life.y + lifeRadius(life) + 28);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(207,234,246,.5)';
  ctx.fillText(life.trait || '', life.x, life.y + lifeRadius(life) + 42);
}

export function createEvent(W: number, H: number): TankEvent {
  const type = EVENT_TYPES[(Math.random() * EVENT_TYPES.length) | 0];
  const ang = Math.random() * Math.PI * 2;
  return {
    x: Math.random() * W, y: Math.random() * H,
    dirx: Math.cos(ang), diry: Math.sin(ang),
    baseSpeed: 0.8 + Math.random() * 2.6, speed: 0.8,
    t: Math.random() * 1000, oscFreq: 0.003 + Math.random() * 0.012,
    label: type.label, hue: type.hue,
    size: 7 + Math.random() * 18, life: 600 + Math.random() * 600, maxLife: 600,
    trail: [],
  };
}

export function updateEvent(ev: TankEvent, W: number, H: number) {
  ev.t++;
  ev.speed = ev.baseSpeed * (1 + 0.5 * Math.sin(ev.t * ev.oscFreq));
  ev.x += ev.dirx * ev.speed; ev.y += ev.diry * ev.speed;
  if (ev.x < 0) { ev.x = 0; ev.dirx *= -1; }
  if (ev.x > W) { ev.x = W; ev.dirx *= -1; }
  if (ev.y < 0) { ev.y = 0; ev.diry *= -1; }
  if (ev.y > H) { ev.y = H; ev.diry *= -1; }
  ev.life--;
  ev.trail.push({ x: ev.x, y: ev.y }); if (ev.trail.length > 14) ev.trail.shift();
}

export function drawEvent(ctx: CanvasRenderingContext2D, ev: TankEvent) {
  const a = Math.min(1, ev.life / 120);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ev.trail.length; i++) {
    const t = ev.trail[i]; const al = (i / ev.trail.length) * 0.25 * a;
    ctx.fillStyle = `hsla(${ev.hue},90%,80%,${al})`;
    ctx.beginPath(); ctx.arc(t.x, t.y, ev.size * (i / ev.trail.length) * 0.6, 0, 7); ctx.fill();
  }
  const g = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, ev.size * 2.2);
  g.addColorStop(0, `hsla(${ev.hue},100%,92%,${0.9 * a})`);
  g.addColorStop(0.4, `hsla(${ev.hue},95%,70%,${0.5 * a})`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.size * 2.2, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  if (ev.trail.length) {
    const tail = ev.trail[0];
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `hsla(${ev.hue},90%,78%,${0.9 * a})`;
    ctx.fillText(ev.label, tail.x, tail.y);
  }
}

// 背景粒子（世界氛围）
export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  // 深色渐变
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  bg.addColorStop(0, '#06202f');
  bg.addColorStop(1, '#031018');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 光点漂浮
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = (i * 127.3 + t * 0.2) % W;
    const y = (i * 83.7 + Math.sin(t * 0.01 + i) * 30) % H;
    const a = 0.08 + 0.06 * Math.sin(t * 0.02 + i * 2);
    ctx.fillStyle = `hsla(190,80%,70%,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
