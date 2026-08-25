// =========================================================
// 《我的世界》数据存取：三个 JSON 文件，原子写（临时文件 + rename 替换）。
// 单机试听课足够；多实例部署需替换为 DB/共享存储。
// =========================================================

import fs from 'fs';
import path from 'path';
import type { WorldControl, WorldLives, WorldState, WorldStatus } from './engine';
import type { LifeSpec } from './spec';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'world');
const CONTROL_FILE = path.join(DATA_DIR, 'world-control.json');
const LIVES_FILE = path.join(DATA_DIR, 'world-lives.json');
const STATE_FILE = path.join(DATA_DIR, 'world-state.json');
const POPUP_FILE = path.join(DATA_DIR, 'world-popup.json');
const VISUAL_FILE = path.join(DATA_DIR, 'world-visual.json');

function ensureDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// ---------- control ----------

export function defaultControl(): WorldControl {
  // 世界自动运行：进入 A3 即 running，无需教师控制状态机
  return { status: 'running', round: 1, revision: 0, updatedAt: Date.now() };
}

export function readControl(): WorldControl {
  return readJson<WorldControl>(CONTROL_FILE, defaultControl());
}

export function writeControl(control: WorldControl): void {
  control.updatedAt = Date.now();
  writeJsonAtomic(CONTROL_FILE, control);
}

export function transitionControl(
  action: 'startCreate' | 'startRound1' | 'startRevise' | 'startRound2' | 'finish',
): WorldControl {
  const cur = readControl();
  const next: WorldControl = { ...cur, revision: cur.revision + 1, updatedAt: Date.now() };
  switch (action) {
    case 'startCreate':
      next.status = 'creating';
      next.round = 1;
      break;
    case 'startRound1':
      next.status = 'running';
      next.round = 1;
      break;
    case 'startRevise':
      next.status = 'revising';
      break;
    case 'startRound2':
      next.status = 'running';
      next.round = 2;
      break;
    case 'finish':
      next.status = 'finished';
      break;
  }
  writeControl(next);
  return next;
}

// ---------- lives ----------

export function readLives(): WorldLives {
  return readJson<WorldLives>(LIVES_FILE, { lives: [] });
}

export function writeLives(lives: WorldLives): void {
  writeJsonAtomic(LIVES_FILE, lives);
}

// 学生提交/更新生命版本
export function upsertLife(
  sid: string,
  input: {
    name: string;
    color: string;
    version: number;
    text?: string;
    shape?: string;
    spec?: LifeSpec;
    social: number;
    helpful: number;
    cautious: number;
  },
): WorldLives {
  const data = readLives();
  const id = `life-${sid}`;
  const existing = data.lives.find((l) => l.sid === sid);
  const version = {
    version: input.version,
    text: input.text || '',
    shape: input.shape || undefined,
    spec: input.spec || undefined,
    social: input.social,
    helpful: input.helpful,
    cautious: input.cautious,
    submitted: true,
  };
  if (existing) {
    const idx = existing.versions.findIndex((v) => v.version === input.version);
    if (idx >= 0) existing.versions[idx] = version;
    else existing.versions.push(version);
    existing.name = input.name;
    existing.color = input.color;
  } else {
    data.lives.push({
      id,
      sid,
      name: input.name,
      color: input.color,
      versions: [version],
    });
  }
  writeLives(data);
  return data;
}

// ---------- popup（大屏按需弹窗，教师控制） ----------

export interface WorldPopup {
  show: boolean;
  content: 'usage' | 'method' | 'tip01' | 'tip02' | 'tip03' | 'tip04' | 'tip05' | 'tip06' | 'tip07' | 'tip08' | null;
  updatedAt: number;
}

export function defaultPopup(): WorldPopup {
  return { show: false, content: null, updatedAt: Date.now() };
}

export function readPopup(): WorldPopup {
  return readJson<WorldPopup>(POPUP_FILE, defaultPopup());
}

export function writePopup(popup: WorldPopup): void {
  popup.updatedAt = Date.now();
  writeJsonAtomic(POPUP_FILE, popup);
}

export const POPUP_CONTENTS = [
  'usage',
  'method',
  'tip01',
  'tip02',
  'tip03',
  'tip04',
  'tip05',
  'tip06',
  'tip07',
  'tip08',
] as const;
export type PopupContent = (typeof POPUP_CONTENTS)[number];

export function setPopup(content: PopupContent | null, show: boolean): WorldPopup {
  const next: WorldPopup = { show, content, updatedAt: Date.now() };
  writePopup(next);
  return next;
}

// ---------- visual（大屏环境光斑整体速度/亮度，教师调节） ----------

export interface WorldVisual {
  speed: number; // 速度系数 0.3..3，默认 1
  brightness: number; // 亮度系数 0.3..3，默认 1
  updatedAt: number;
}

export function defaultVisual(): WorldVisual {
  return { speed: 1, brightness: 1, updatedAt: Date.now() };
}

export function readVisual(): WorldVisual {
  return readJson<WorldVisual>(VISUAL_FILE, defaultVisual());
}

export function setVisual(speed: number, brightness: number): WorldVisual {
  const next: WorldVisual = {
    speed: clampRange(speed, 0.3, 3),
    brightness: clampRange(brightness, 0.3, 3),
    updatedAt: Date.now(),
  };
  writeJsonAtomic(VISUAL_FILE, next);
  return next;
}

function clampRange(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return 1;
  return Math.min(hi, Math.max(lo, v));
}

// ---------- state ----------

export function readState(): WorldState | null {
  try {
    return readJson<WorldState>(STATE_FILE, null as unknown as WorldState);
  } catch {
    return null;
  }
}

export function writeState(state: WorldState): void {
  writeJsonAtomic(STATE_FILE, state);
}
