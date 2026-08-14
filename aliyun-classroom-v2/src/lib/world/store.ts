// =========================================================
// 《我的世界》数据存取：三个 JSON 文件，原子写（临时文件 + rename 替换）。
// 单机试听课足够；多实例部署需替换为 DB/共享存储。
// =========================================================

import fs from 'fs';
import path from 'path';
import type { WorldControl, WorldLives, WorldState, WorldStatus } from './engine';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'world');
const CONTROL_FILE = path.join(DATA_DIR, 'world-control.json');
const LIVES_FILE = path.join(DATA_DIR, 'world-lives.json');
const STATE_FILE = path.join(DATA_DIR, 'world-state.json');

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
  return { status: 'creating', round: 1, revision: 0, updatedAt: Date.now() };
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
