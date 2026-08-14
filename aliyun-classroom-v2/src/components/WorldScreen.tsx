'use client';
// =========================================================
// 《我的世界》大屏端：左侧世界状态 + 中央 Canvas 公共世界 + 右侧关键动态
// 每 2 秒轮询 /api/world，Canvas 绘制生命与资源。
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
}

interface WorldData {
  status: string;
  round: number;
  simulationTime: number;
  lives: WorldLife[];
  resources: Resource[];
  keyEvents: KeyEvent[];
}

export default function WorldScreen({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<WorldData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let closed = false;
    async function load() {
      try {
        const r = await fetch(`/api/world?view=screen&sessionId=${sessionId}`);
        const d = await r.json();
        if (!closed) setData(d);
      } catch { /* noop */ }
    }
    load();
    const t = setInterval(load, 2000);
    return () => { closed = true; clearInterval(t); };
  }, [sessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#0a1128';
    ctx.fillRect(0, 0, W, H);

    // 关系连线（重要关系）
    for (const l of data.lives) {
      if (!l.importantRelations) continue;
      for (const r of l.importantRelations) {
        const other = data.lives.find((o) => o.id === r.lifeId);
        if (!other) continue;
        ctx.strokeStyle = `rgba(56,189,248,${0.15 + (r.value / 100) * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.x * W, l.y * H);
        ctx.lineTo(other.x * W, other.y * H);
        ctx.stroke();
      }
    }

    // 资源
    for (const res of data.resources) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(res.x * W, res.y * H, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 生命
    for (const l of data.lives) {
      const cx = l.x * W;
      const cy = l.y * H;
      const r = l.state === 'sleeping' ? 7 : 11;
      ctx.globalAlpha = l.state === 'sleeping' ? 0.35 : 1;
      // 光圈
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // 名字
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(l.name, cx, cy - r - 5);
      if (l.state === 'sleeping') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('💤', cx, cy + 3);
      }
    }
  }, [data]);

  if (!data) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '30vh' }}>《我的世界》加载中…</div>;
  }

  const active = data.lives.filter((l) => l.state === 'active').length;
  const sleeping = data.lives.length - active;
  const avgEnergy = data.lives.length ? Math.round(data.lives.reduce((s, l) => s + l.energy, 0) / data.lives.length) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 16, height: 'calc(100vh - 120px)' }}>
      {/* 左：世界状态 */}
      <div style={{ background: '#0e1730', border: '1px solid #26324d', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, color: '#9fb0d0', fontWeight: 700 }}>世界状态</div>
        <Stat label="轮次" value={`第 ${data.round} 轮`} />
        <Stat label="运行时间" value={`${Math.floor(data.simulationTime / 60)}:${String(Math.floor(data.simulationTime % 60)).padStart(2, '0')}`} />
        <Stat label="生命数" value={`${data.lives.length}`} />
        <Stat label="活跃" value={`${active}`} />
        <Stat label="休眠" value={`${sleeping}`} />
        <Stat label="平均能量" value={`${avgEnergy}`} />
        <Stat label="阶段" value={labelOf(data.status, data.round)} />
      </div>

      {/* 中：Canvas 世界 */}
      <div style={{ position: 'relative', background: '#0a1128', border: '1px solid #26324d', borderRadius: 12, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        {data.lives.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 20 }}>
            世界空着，等待生命进入…
          </div>
        )}
      </div>

      {/* 右：关键动态 */}
      <div style={{ background: '#0e1730', border: '1px solid #26324d', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, color: '#9fb0d0', fontWeight: 700 }}>世界正在发生</div>
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
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>{value}</div>
    </div>
  );
}

function labelOf(status: string, round: number): string {
  const map: Record<string, string> = {
    creating: '创建阶段',
    running: `运行中`,
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
