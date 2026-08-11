'use client';
// =========================================================
// A0 新版 · 大屏组件（三问进行中 / 关系题投票 / 揭晓+讲解）
// 数据自取（内部轮询），与页面解耦。
// =========================================================
import { useEffect, useState } from 'react';
import { A0_QUESTIONS, A0_VOTE_OPTIONS, A0_REVEAL } from '@/features/avatarLesson/config';

interface A0Data {
  total: number;
  answered: number;
  voted: number;
  tool: number;
  partner: number;
  answerCountByQuestion: number[];
}

export default function AvatarA0Screen({
  type,
  sessionId,
  subState,
  total,
}: {
  type: string; // A0N_QUESTIONS | A0N_VOTE | A0N_REVEAL
  sessionId: string;
  subState: string | null;
  total: number;
}) {
  const [data, setData] = useState<A0Data | null>(null);
  const [imgFailed, setImgFailed] = useState<boolean[]>([false, false]);

  useEffect(() => {
    let closed = false;
    async function fetchIt() {
      try {
        const r = await fetch(`/api/avatar/a0/analytics?sessionId=${sessionId}`);
        if (!closed) setData(await r.json());
      } catch { /* noop */ }
    }
    fetchIt();
    const iv = setInterval(fetchIt, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [sessionId]);

  // 三问进行中
  if (type === 'A0N_QUESTIONS') {
    return (
      <div className="a0-live">
        <div className="a0-topbar">
          <div className="a0-brand">A0 · 你和 AI</div>
          <div className="a0-tag">三问进行中</div>
        </div>
        <div className="a0-stage">
          <div className="a0-question" style={{ textAlign: 'center' }}>你平时会让 AI 帮你做什么？</div>
          <div className="a0-snap" style={{ maxWidth: 760 }}>
            <div className="a0-snap-title">正在收集三问 · 已回答</div>
            <div className="a0-bars">
              {A0_QUESTIONS.map((q, i) => {
                const c = data?.answerCountByQuestion?.[i] ?? 0;
                const pctT = total > 0 ? Math.round((c / total) * 100) : 0;
                return (
                  <div className="a0-bar-row" key={q.key}>
                    <div className="a0-bar-name" style={{ width: 130, textAlign: 'right' }}>{i + 1} · {q.title.length > 6 ? q.title.slice(0, 6) + '…' : q.title}</div>
                    <div className="a0-bar-track"><div className="a0-bar-fill" style={{ width: pctT + '%', background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} /></div>
                    <div className="a0-bar-pct">{c}/{total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="a0-foot">
          <div className="a0-status">正在读取每一位同学的真实回答…</div>
        </div>
      </div>
    );
  }

  // 关系题投票进行中
  if (type === 'A0N_VOTE') {
    const tool = data?.tool ?? 0;
    const partner = data?.partner ?? 0;
    const voted = data?.voted ?? 0;
    const lp = voted > 0 ? Math.round((tool / Math.max(1, voted)) * 100) : 0;
    const pp = voted > 0 ? Math.round((partner / Math.max(1, voted)) * 100) : 0;
    return (
      <div className="a0-live">
        <div className="a0-topbar">
          <div className="a0-brand">A0 · 你和 AI</div>
          <div className="a0-tag">关系题投票中 · {voted}/{total}</div>
        </div>
        <div className="a0-stage">
          <div className="a0-question" style={{ textAlign: 'center' }}>在你的生活里，AI 更像是你的——</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: 'min(1100px, 92vw)', marginTop: 6 }}>
            {A0_VOTE_OPTIONS.map((o) => {
              const v = o.id === 'tool' ? tool : partner;
              const p = o.id === 'tool' ? lp : pp;
              const lead = o.id === 'tool' ? tool >= partner : partner > tool;
              return (
                <div key={o.id} style={{ background: 'rgba(15,23,42,0.55)', border: lead ? '1px solid rgba(124,58,237,0.6)' : '1px solid var(--border)', borderRadius: 20, padding: '34px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 54 }}>{o.icon}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 4px' }}>{o.label}</div>
                  <div style={{ fontSize: 15, color: 'var(--muted)' }}>{o.desc}</div>
                  <div style={{ fontSize: 64, fontWeight: 900, marginTop: 14, color: lead ? '#c4b5fd' : '#e2e8f0' }}>{p}%</div>
                  <div style={{ fontSize: 18, color: 'var(--muted)' }}>{v} 人</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="a0-foot">
          <div className="a0-status">每人只有一次选择 · 揭晓后我们再看「过去 vs 未来」</div>
        </div>
      </div>
    );
  }

  // A0-3 揭晓 + 讲解（教师用 subState: reveal:1/2/3 控制）
  const tool = data?.tool ?? 0;
  const partner = data?.partner ?? 0;
  const voted = Math.max(1, data?.voted ?? 1);
  const lp = Math.round((tool / voted) * 100);
  const pp = Math.round((partner / voted) * 100);
  const reveal = subState ?? 'reveal:1';
  const screen = reveal === 'reveal:2' ? 'pvf' : reveal === 'reveal:3' ? 'art' : 'result';

  return (
    <div className="a0-reveal">
      {screen === 'result' && (
        <>
          <div className="a0-reveal-statement">{A0_REVEAL.headline}</div>
          <div className="a0-snap" style={{ maxWidth: 900 }}>
            <div className="a0-bars">
              {[
                { name: '工具 🔧', val: tool, pct: lp, c: '#fde047' },
                { name: '伙伴 🤝', val: partner, pct: pp, c: '#86efac' },
              ].map((b) => (
                <div className="a0-bar-row" key={b.name}>
                  <div className="a0-bar-name">{b.name}</div>
                  <div className="a0-bar-track"><div className="a0-bar-fill" style={{ width: b.pct + '%', background: b.c }} /></div>
                  <div className="a0-bar-pct">{b.pct}% · {b.val} 人</div>
                </div>
              ))}
            </div>
            <div className="a0-snap-note">今天这节课，我们不急着下结论。先看看，把 AI 当工具的过去，和当伙伴的未来，流程差在哪。</div>
          </div>
        </>
      )}

      {screen === 'pvf' && (
        <>
          <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>过去 · 当工具 &nbsp;vs&nbsp; 未来 · 当伙伴</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, width: 'min(1100px, 94vw)' }}>
            <div style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid var(--border)', borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fde047', marginBottom: 14 }}>{A0_REVEAL.pastVsFuture.past.title}</div>
              {A0_REVEAL.pastVsFuture.past.flow.map((f, i) => (
                <div key={i} style={{ fontSize: 18, color: '#e2e8f0', margin: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{['📤','⚡','🏃'][i] ?? '•'}</span> {f}
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.5)', borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c4b5fd', marginBottom: 14 }}>{A0_REVEAL.pastVsFuture.future.title}</div>
              {A0_REVEAL.pastVsFuture.future.flow.map((f, i) => (
                <div key={i} style={{ fontSize: 18, color: '#e2e8f0', margin: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{['👤','🔁','✓','🧠'][i] ?? '•'}</span> {f}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {screen === 'art' && (
        <>
          <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>接下来，我们一起把 AI 变成「伙伴」</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, width: 'min(1400px, 96vw)' }}>
            {A0_REVEAL.artImages.map((img, i) => (
              <div key={i} style={{ borderRadius: 18, border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.10)', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {imgFailed[i] ? (
                  <>
                    <div style={{ fontSize: 48 }}>{i === 0 ? '🛠️' : '🤝'}</div>
                    <div style={{ fontSize: 16, color: '#c4b5fd', marginTop: 8 }}>{i === 0 ? '把 AI 当工具（过去）' : '把 AI 当伙伴（未来）'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>图片位 · 请把艺术图放到 /avatar/A0-art-{i + 1}.jpg</div>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={`A0-art-${i + 1}`} style={{ width: '100%', objectFit: 'contain', maxHeight: '60vh' }} onError={() => setImgFailed((f) => f.map((v, j) => (j === i ? true : v)))} />
                )}
              </div>
            ))}
          </div>
          <div className="a0-next">下一环节 · 一起养一个「数字的你」</div>
        </>
      )}
    </div>
  );
}
