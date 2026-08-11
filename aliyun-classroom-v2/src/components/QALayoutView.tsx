'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { QALayout } from '@/lib/closingConfig';

const C = {
  txt: '#e2e8f0',
  sub: '#94a3b8',
  blue: '#38bdf8',
  green: '#22c55e',
  yellow: '#eab308',
  line: '#26324d',
  card: 'rgba(255,255,255,.04)',
};

// 大屏解答画面 / 学生端预制答案 共用的模板渲染器。
// compact=true 用于手机端（较小字号、卡片式）。
export default function QALayoutView({ layout, compact }: { layout: QALayout; compact?: boolean }) {
  const f = (n: number) => (compact ? Math.round(n * 0.72) : n);
  const gap = compact ? 10 : 18;

  let body: ReactNode = null;

  if (layout.kind === 'compare') {
    body = (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: f(16), fontWeight: 800, color: C.sub }}>{layout.leftTitle}</div>
          <div style={{ fontSize: f(16), fontWeight: 800, color: C.green }}>{layout.rightTitle}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap }}>
          {layout.rows!.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: f(16), color: C.sub, background: C.card, borderRadius: 10, padding: '12px 14px' }}>{r.left}</div>
              <div style={{ fontSize: f(16), color: C.txt, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 10, padding: '12px 14px', fontWeight: 700 }}>{r.right}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (layout.kind === 'timeline') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gap }}>
        {layout.segments!.map((s, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: compact ? 12 : 16 }}>
            <div style={{ fontSize: f(15), fontWeight: 800, color: C.blue, marginBottom: 8 }}>{s.time}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.items.map((it, j) => (
                <div key={j} style={{ fontSize: f(15), color: C.txt, paddingLeft: 12, borderLeft: `3px solid ${C.blue}` }}>{it}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (layout.kind === 'list') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gap }}>
        {layout.items!.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: compact ? 12 : 16 }}>
            <span style={{ width: f(22), height: f(22), borderRadius: 6, flexShrink: 0, background: C.blue, color: '#04263a', fontSize: f(12), fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{i + 1}</span>
            <span style={{ fontSize: f(16), color: C.txt, lineHeight: 1.6 }}>{it}</span>
          </div>
        ))}
      </div>
    );
  } else if (layout.kind === 'steps') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gap }}>
        {layout.steps!.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ width: f(26), height: f(26), borderRadius: '50%', flexShrink: 0, background: C.green, color: '#06210f', fontSize: f(13), fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{i + 1}</span>
            <span style={{ fontSize: f(17), color: C.txt, lineHeight: 1.7 }}>{it}</span>
          </div>
        ))}
      </div>
    );
  } else if (layout.kind === 'grid') {
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2,1fr)', gap: gap }}>
        {layout.grid!.map((it, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: compact ? 12 : 16, fontSize: f(16), color: C.txt, lineHeight: 1.6 }}>{it}</div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {body}
      {layout.needConfig ? (
        <div style={{ marginTop: gap, fontSize: f(13), color: C.yellow, background: 'rgba(234,179,8,.1)', border: '1px solid rgba(234,179,8,.3)', borderRadius: 8, padding: '8px 12px' }}>
          ⚠ 规则待确认：本页内容以报名时官方说明为准，讲师现场不模糊承诺。
        </div>
      ) : null}
      {layout.bottom ? (
        <div style={{ marginTop: gap, fontSize: f(18), fontWeight: 800, color: C.green, lineHeight: 1.6 }}>{layout.bottom}</div>
      ) : null}
    </div>
  );
}
