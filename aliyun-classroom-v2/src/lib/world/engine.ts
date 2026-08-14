// =========================================================
// 《我的世界》最小世界引擎（试听课版）
// 纯函数核心：无 I/O、无 Prisma、可复现（seed 注入随机源）。
// 惰性推进：由调用方按墙钟时间差调用 advance() 补算 tick。
// 设计目标：30 分钟课堂里稳定、看得懂——生命会靠近/帮助/回避/找资源，
//           关系值真实累积并影响下一次靠近与帮助。
// =========================================================

// ---------- 数据定义 ----------

export type WorldStatus = 'creating' | 'running' | 'revising' | 'finished';

export interface WorldControl {
  status: WorldStatus;
  round: number;
  revision: number;
  updatedAt: number;
}

export interface LifeVersion {
  version: number;
  social: number; // 0..1 亲近倾向
  helpful: number; // 0..1 帮助倾向
  cautious: number; // 0..1 谨慎倾向
  submitted: boolean;
}

export interface LifeRecord {
  id: string; // life-<anonymousId>
  sid: string; // anonymousId
  name: string;
  color: string;
  versions: LifeVersion[];
}

export interface WorldLives {
  lives: LifeRecord[];
}

export interface StateLife {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  energy: number;
  state: 'active' | 'sleeping';
  action: string;
  reason: string;
  relations: Record<string, number>; // lifeId -> 0..100
  activeVersion: number;
  social: number;
  helpful: number;
  cautious: number;
}

export interface Resource {
  id: string;
  x: number;
  y: number;
}

export interface KeyEvent {
  t: number;
  text: string;
  lifeId?: string; // 事件发生在哪个生命（大屏据此生成光点）
}

export interface WorldState {
  updatedAt: number;
  simulationTime: number; // 秒
  status: WorldStatus;
  round: number;
  lives: StateLife[];
  resources: Resource[];
  keyEvents: KeyEvent[];
}

// ---------- 引擎配置 ----------

export interface EngineConfig {
  relationshipFeedbackEnabled: boolean; // 关系是否真实参与靠近/帮助决策
  seed: number;
  tickSeconds: number;
  maxCatchUpTicks: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  relationshipFeedbackEnabled: true,
  seed: 42,
  tickSeconds: 1,
  maxCatchUpTicks: 120,
};

// 规则常量
const ENERGY_START = 80;
const ENERGY_MOVE_COST = 0.2;
const ENERGY_RESOURCE_GAIN = 20;
const ENERGY_HELP_SELF_COST = 8;
const ENERGY_HELP_TARGET_GAIN = 12;
const SLEEP_WAKE_AT = 20;
const SLEEP_REGEN = 0.5;
const LOW_ENERGY = 35;
const SENSE_RADIUS = 0.2; // 感知范围（含相遇）
const HELP_RADIUS = 0.08;
const RESOURCE_PICK_RADIUS = 0.05;
const REL_ENCOUNTER_GAIN = 1;
const REL_HELP_GAIN = 10;
const REL_DECAY = 1;
const RESOURCE_CAP = 12;
const RESOURCE_SPAWN_CHANCE = 0.3;
const MAX_SPEED = 0.014;

// ---------- 随机源 ----------

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 工具 ----------

function randPos(rng: Rng): { x: number; y: number } {
  // 出生在中央区域（0.2~0.8），让生命更容易相遇互动
  return { x: 0.2 + rng() * 0.6, y: 0.2 + rng() * 0.6 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function moveToward(life: StateLife, tx: number, ty: number, speed: number): void {
  const d = distance(life, { x: tx, y: ty });
  if (d < 0.0001) return;
  const step = Math.min(speed, d);
  life.x = clamp(life.x + ((tx - life.x) / d) * step, 0.03, 0.97);
  life.y = clamp(life.y + ((ty - life.y) / d) * step, 0.03, 0.97);
}

function moveAway(life: StateLife, tx: number, ty: number, speed: number): void {
  const d = distance(life, { x: tx, y: ty });
  if (d < 0.0001) return;
  life.x = clamp(life.x - ((tx - life.x) / d) * speed, 0.03, 0.97);
  life.y = clamp(life.y - ((ty - life.y) / d) * speed, 0.03, 0.97);
}

function relWith(life: StateLife, otherId: string): number {
  return life.relations[otherId] ?? 0;
}

function addRel(a: StateLife, b: StateLife, delta: number): void {
  a.relations[b.id] = clamp(relWith(a, b.id) + delta, 0, 100);
  b.relations[a.id] = clamp(relWith(b, a.id) + delta, 0, 100);
}

// ---------- 世界初始化 ----------

function latestSubmitted(rec: LifeRecord, round: number): LifeVersion {
  const v = rec.versions.find((x) => x.version === round && x.submitted);
  if (v) return v;
  const any = [...rec.versions].reverse().find((x) => x.submitted);
  return any ?? { version: round, social: 0.5, helpful: 0.5, cautious: 0.5, submitted: true };
}

export function createInitialState(
  lives: LifeRecord[],
  control: WorldControl,
  config: EngineConfig,
  rng: Rng,
): WorldState {
  const stateLives: StateLife[] = lives.map((rec) => {
    const v = latestSubmitted(rec, control.round);
    const p = randPos(rng);
    return {
      id: rec.id,
      name: rec.name,
      color: rec.color,
      x: p.x,
      y: p.y,
      energy: ENERGY_START,
      state: 'active',
      action: 'wander',
      reason: '刚刚进入世界，正在熟悉环境',
      relations: {},
      activeVersion: control.round,
      social: v.social,
      helpful: v.helpful,
      cautious: v.cautious,
    };
  });

  const resources: Resource[] = [];
  for (let i = 0; i < 6; i++) {
    const p = randPos(rng);
    resources.push({ id: `r${i}`, x: p.x, y: p.y });
  }

  return {
    updatedAt: Date.now(),
    simulationTime: 0,
    status: control.status,
    round: control.round,
    lives: stateLives,
    resources,
    keyEvents: [],
  };
}

// ---------- 单 tick 推进 ----------

function tick(state: WorldState, config: EngineConfig, rng: Rng): void {
  state.simulationTime += config.tickSeconds;

  // 资源生成
  if (state.resources.length < RESOURCE_CAP && rng() < RESOURCE_SPAWN_CHANCE) {
    const p = randPos(rng);
    state.resources.push({ id: `r${state.simulationTime}-${state.resources.length}`, x: p.x, y: p.y });
  }

  const activeLives = state.lives.filter((l) => l.state === 'active');

  // 相遇检测：距离近的 active 生命对，关系 +1（关系累积的基础来源）
  for (let i = 0; i < activeLives.length; i++) {
    for (let j = i + 1; j < activeLives.length; j++) {
      const a = activeLives[i];
      const b = activeLives[j];
      if (distance(a, b) < SENSE_RADIUS) {
        addRel(a, b, REL_ENCOUNTER_GAIN);
      }
    }
  }

  for (const life of state.lives) {
    // 休眠生命缓慢恢复
    if (life.state === 'sleeping') {
      life.energy = clamp(life.energy + SLEEP_REGEN, 0, ENERGY_START);
      if (life.energy >= SLEEP_WAKE_AT) {
        life.state = 'active';
        life.action = 'wander';
        life.reason = '恢复了能量，重新活动';
        state.keyEvents.push({ t: state.simulationTime, text: `${life.name} 苏醒了`, lifeId: life.id });
      } else {
        life.action = 'sleeping';
        life.reason = '能量耗尽，正在休眠恢复';
        continue;
      }
    }

    // 移动消耗
    life.energy = clamp(life.energy - ENERGY_MOVE_COST, 0, ENERGY_START);
    if (life.energy <= 0) {
      life.state = 'sleeping';
      life.action = 'sleeping';
      life.reason = '能量耗尽，进入休眠';
      state.keyEvents.push({ t: state.simulationTime, text: `${life.name} 能量耗尽，休眠了`, lifeId: life.id });
      continue;
    }

    const others = state.lives.filter((o) => o.id !== life.id && o.state === 'active');

    // 1. 找资源（低能量优先）
    if (life.energy < LOW_ENERGY) {
      let bestRes: Resource | null = null;
      let bestD = Infinity;
      for (const r of state.resources) {
        const d = distance(life, r);
        if (d < bestD) { bestD = d; bestRes = r; }
      }
      if (bestRes) {
        if (bestD < RESOURCE_PICK_RADIUS) {
          const idx = state.resources.findIndex((r) => r.id === bestRes!.id);
          if (idx >= 0) state.resources.splice(idx, 1);
          life.energy = clamp(life.energy + ENERGY_RESOURCE_GAIN, 0, ENERGY_START);
          life.action = 'find_resource';
          life.reason = '能量偏低，找到资源并补充了能量';
          continue;
        }
        moveToward(life, bestRes.x, bestRes.y, MAX_SPEED);
        life.action = 'find_resource';
        life.reason = '能量偏低，正在前往附近的资源';
        continue;
      }
    }

    // 2. 帮助（附近低能量伙伴）
    let helpTarget: StateLife | null = null;
    let helpD = Infinity;
    for (const o of others) {
      if (o.energy < LOW_ENERGY) {
        const d = distance(life, o);
        if (d < SENSE_RADIUS && d < helpD) { helpD = d; helpTarget = o; }
      }
    }
    if (helpTarget) {
      const rel = relWith(life, helpTarget.id);
      const relBonus = config.relationshipFeedbackEnabled ? (rel / 100) * 0.4 : 0;
      const p = clamp(life.helpful + relBonus, 0, 1);
      if (helpD < HELP_RADIUS && rng() < p && life.energy > ENERGY_HELP_SELF_COST) {
        life.energy = clamp(life.energy - ENERGY_HELP_SELF_COST, 0, ENERGY_START);
        helpTarget.energy = clamp(helpTarget.energy + ENERGY_HELP_TARGET_GAIN, 0, ENERGY_START);
        addRel(life, helpTarget, REL_HELP_GAIN);
        life.action = 'help';
        life.reason = `${helpTarget.name} 能量不足，选择了帮助`;
        state.keyEvents.push({ t: state.simulationTime, text: `${life.name} 帮助了 ${helpTarget.name}`, lifeId: life.id });
        continue;
      }
      // 有意帮助但没到距离：朝它靠近
      moveToward(life, helpTarget.x, helpTarget.y, MAX_SPEED * 0.8);
      life.action = 'approach_help';
      life.reason = `想去帮助能量不足的 ${helpTarget.name}`;
      continue;
    }

    // 3. 回避（谨慎高且附近拥挤）
    const nearby = others.filter((o) => distance(life, o) < SENSE_RADIUS);
    if (nearby.length >= 2 && life.cautious > 0.55) {
      let nearest: StateLife | null = null;
      let nd = Infinity;
      for (const o of nearby) { const d = distance(life, o); if (d < nd) { nd = d; nearest = o; } }
      if (nearest) {
        moveAway(life, nearest.x, nearest.y, MAX_SPEED * 0.7);
        life.action = 'avoid';
        life.reason = '附近生命较多，选择了回避';
        continue;
      }
    }

    // 4. 靠近（亲近高，找最近的伙伴；关系加成选目标）
    if (life.social > 0.45 && others.length > 0) {
      let bestOther: StateLife | null = null;
      let bestScore = -1;
      for (const o of others) {
        const d = distance(life, o);
        if (d > SENSE_RADIUS * 2) continue; // 太远不靠近
        const rel = relWith(life, o.id);
        const relScore = config.relationshipFeedbackEnabled ? rel : 0;
        const score = relScore - d * 100; // 关系越高、越近，越优先
        if (score > bestScore) { bestScore = score; bestOther = o; }
      }
      if (bestOther) {
        moveToward(life, bestOther.x, bestOther.y, MAX_SPEED * 0.7);
        life.action = 'approach';
        const rel = relWith(life, bestOther.id);
        life.reason = config.relationshipFeedbackEnabled && rel >= 30
          ? `${bestOther.name} 关系较好，主动靠近`
          : '性格亲近，主动靠近伙伴';
        continue;
      }
    }

    // 5. 自由移动
    const dx = (rng() - 0.5) * MAX_SPEED * 2;
    const dy = (rng() - 0.5) * MAX_SPEED * 2;
    life.x = clamp(life.x + dx, 0.03, 0.97);
    life.y = clamp(life.y + dy, 0.03, 0.97);
    life.action = 'wander';
    life.reason = '没有紧急目标，自由探索';

    // 关系衰减
    if (state.simulationTime % 10 === 0) {
      for (const k of Object.keys(life.relations)) {
        life.relations[k] = clamp(life.relations[k] - REL_DECAY, 0, 100);
      }
    }
  }

  if (state.keyEvents.length > 8) {
    state.keyEvents = state.keyEvents.slice(-8);
  }
}

// ---------- 惰性推进 ----------

export function advance(
  state: WorldState,
  config: EngineConfig,
  now: number,
): { state: WorldState; advancedSeconds: number } {
  if (state.status !== 'running') {
    state.updatedAt = now;
    return { state, advancedSeconds: 0 };
  }
  const elapsedMs = Math.max(0, now - state.updatedAt);
  const elapsedTicks = Math.floor(elapsedMs / (config.tickSeconds * 1000));
  const ticks = Math.min(elapsedTicks, config.maxCatchUpTicks);
  const rng = makeRng(config.seed + state.simulationTime);
  for (let i = 0; i < ticks; i++) {
    tick(state, config, rng);
  }
  state.updatedAt = now;
  return { state, advancedSeconds: ticks * config.tickSeconds };
}
