// 内存事件总线：单实例实时同步（开发/单课堂足够）。
// 生产多实例部署时，将此模块替换为 Supabase Realtime 或 Redis Pub/Sub 即可。

import { EventEmitter } from 'events';

type Handler = (event: RealtimeEvent) => void;

export interface RealtimeEvent {
  type: string;
  payload: unknown;
}

// Next.js App Router 在 dev 模式下每个 API Route 会独立加载模块，
// 普通模块级 EventEmitter 无法共享。把 bus 挂在 globalThis 上确保单例。
const globalStore = globalThis as typeof globalThis & { __classroomEventBus?: EventEmitter };
const bus = globalStore.__classroomEventBus ?? new EventEmitter();
if (!globalStore.__classroomEventBus) {
  globalStore.__classroomEventBus = bus;
  bus.setMaxListeners(0);
}

const key = (sessionId: string) => `session:${sessionId}`;

export function publish(sessionId: string, event: RealtimeEvent): void {
  bus.emit(key(sessionId), event);
}

export function subscribe(sessionId: string, handler: Handler): () => void {
  const k = key(sessionId);
  bus.on(k, handler);
  return () => bus.off(k, handler);
}
