'use client';
// =========================================================
// A0 新版 · 大屏组件（三问进行中 / 关系题投票 / 揭晓+讲解）
// 数据自取（内部轮询），与页面解耦。
// =========================================================
import { useEffect, useState } from 'react';
import { A0_QUESTIONS, A0_VOTE_OPTIONS, A0_REVEAL } from '@/features/avatarLesson/config';
import ContentSlot from './ContentSlot';

interface A0Data {
  total: number;
  answered: number;
  voted: number;
  tool: number;
  partner: number;
  answerCountByQuestion: number[];
}

interface A0SlidersData {
  total: number;
  submitted: number;
  byStep: { label: string; buckets: [number, number, number] }[];
  avgHuman: number;
  avgAi: number;
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
  const [sliders, setSliders] = useState<A0SlidersData | null>(null);

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

  // reveal:4 时额外轮询滑杆分布
  const isReveal4 = type === 'A0N_REVEAL' && /^reveal:4(?::\d+)?$/.test(String(subState ?? ''));
  useEffect(() => {
    if (!isReveal4) return;
    let closed = false;
    async function fetchSliders() {
      try {
        const r = await fetch(`/api/avatar/a0/sliders?sessionId=${sessionId}`);
        if (!closed) setSliders(await r.json());
      } catch { /* noop */ }
    }
    fetchSliders();
    const iv = setInterval(fetchSliders, 4000);
    return () => { closed = true; clearInterval(iv); };
  }, [isReveal4, sessionId]);

  // 三问进行中
  if (type === 'A0N_QUESTIONS') {
    return (
      <div className="a0-live">
        <div className="a0-topbar">
          <div className="a0-brand">你和 AI</div>
          <div className="a0-tag">三问进行中</div>
        </div>
        <ContentSlot slot="a0_top" />
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
        <ContentSlot slot="a0_questions_after" />
        <div className="a0-foot">
          <div className="a0-status">正在读取每一位同学的真实回答…</div>
        </div>
      </div>
    );
  }

  // 关系判定中（系统后台判定）
  if (type === 'A0N_VOTE') {
    const tool = data?.tool ?? 0;
    const partner = data?.partner ?? 0;
    const voted = data?.voted ?? 0;
    const lp = voted > 0 ? Math.round((tool / Math.max(1, voted)) * 100) : 0;
    const pp = voted > 0 ? Math.round((partner / Math.max(1, voted)) * 100) : 0;
    return (
      <div className="a0-live">
        <div className="a0-topbar">
          <div className="a0-brand">你和 AI</div>
          <div className="a0-tag">系统判定中 · {voted}/{total}</div>
        </div>
        <ContentSlot slot="a0_top" />
        <div className="a0-stage">
          <div className="a0-question" style={{ textAlign: 'center' }}>根据同学们的答案，AI 正在判断每一位同学——</div>
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
          <div className="a0-status">判定依据是同学们自己写的回答 · 揭晓后我们再看「工具 vs 伙伴」的三种形态</div>
        </div>
      </div>
    );
  }

  // A0-3 揭晓 + 讲解（教师用 subState: reveal:1/2/3[:n]/4[:n] 控制）
  const tool = data?.tool ?? 0;
  const partner = data?.partner ?? 0;
  const voted = Math.max(1, data?.voted ?? 1);
  const lp = Math.round((tool / voted) * 100);
  const pp = Math.round((partner / voted) * 100);
  const reveal = subState ?? 'reveal:1';
  // 图序号：reveal:3 或 reveal:3:1 = 第1张，reveal:3:2 = 第2张（默认第1张）
  const parseArtIdx = (prefix: string): number => {
    const m = String(reveal).match(new RegExp(`^${prefix}(?::(\\d+))?$`));
    const n = m ? parseInt(m[1] ?? '1', 10) : 1;
    return Math.min(2, Math.max(1, n));
  };
  const isArt = /^reveal:3(?::\d+)?$/.test(String(reveal));
  const isSliders = /^reveal:4(?::\d+)?$/.test(String(reveal));
  const screen = isArt ? 'art' : isSliders ? 'sliders' : reveal === 'reveal:2' ? 'pvf' : 'result';
  const artIdx = isArt ? parseArtIdx('reveal:3') : isSliders ? parseArtIdx('reveal:4') : 1;
  const artImg = A0_REVEAL.artImages[artIdx - 1];

  return (
    <div className="a0-reveal">
      <ContentSlot slot="a0_top" />
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
          <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>{A0_REVEAL.formsTable.title}</div>
          <div className="a0-forms-sub">{A0_REVEAL.formsTable.subtitle}</div>
          <div className="a0-forms-table">
            <div className="a0-forms-header">
              <div className="a0-forms-dim" style={{ visibility: 'hidden' }}>维度</div>
              {A0_REVEAL.formsTable.columns.map((c, i) => (
                <div key={c} className={`a0-forms-col-h a0-forms-tone-${i}`}>{c}</div>
              ))}
            </div>
            {A0_REVEAL.formsTable.rows.map((row) => (
              <div className="a0-forms-row" key={row.dim}>
                <div className="a0-forms-dim">{row.dim}</div>
                {row.cells.map((cell, i) => (
                  <div key={i} className={`a0-forms-cell a0-forms-tone-${i}`}>{cell}</div>
                ))}
              </div>
            ))}
            <div className="a0-forms-row a0-forms-punchline">
              <div className="a0-forms-dim">{A0_REVEAL.formsTable.punchline.label}</div>
              {A0_REVEAL.formsTable.punchline.cells.map((cell, i) => (
                <div key={i} className={`a0-forms-cell a0-forms-tone-${i}`}><strong>{cell}</strong></div>
              ))}
            </div>
          </div>
          <ContentSlot slot="a0_forms_after" />
        </>
      )}

      {screen === 'art' && (
        <>
          <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>接下来，我们一起把 AI 变成「伙伴」</div>
          <div style={{ width: 'min(1200px, 88vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ borderRadius: 18, border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.10)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {imgFailed[artIdx - 1] ? (
                <div style={{ padding: '10vh 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 56 }}>{artIdx === 1 ? '🛠️' : '🤝'}</div>
                  <div style={{ fontSize: 18, color: '#c4b5fd', marginTop: 10 }}>{artIdx === 1 ? '把 AI 当工具（过去）' : '把 AI 当伙伴（未来）'}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>图片位 · 请把艺术图放到 /story/A0-{artIdx}.jpg</div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artImg} alt={`A0-${artIdx}`} style={{ width: '100%', objectFit: 'contain', maxHeight: '66vh' }} onError={() => setImgFailed((f) => f.map((v, j) => (j === artIdx - 1 ? true : v)))} />
              )}
            </div>
            <div className="a0-sliders-progress">第 {artIdx} / 2 张 · 上一张/下一张由教师控制</div>
          </div>
          <div className="a0-next">下一环节 · 一起养一个「数字的你」</div>
          <ContentSlot slot="a0_art_after" />
        </>
      )}

      {screen === 'sliders' && (
        <>
          <div className="a0-reveal-statement" style={{ fontSize: 'clamp(24px,3vw,40px)' }}>现在，每个人亲手滑一滑</div>
          <div className="a0-sliders-progress">
            已提交 {sliders?.submitted ?? 0} / {sliders?.total ?? total} 人 · 全体人机比例：人 {sliders?.avgHuman ?? 0}% · AI {sliders?.avgAi ?? 0}%
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 26, width: 'min(1400px, 96vw)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ borderRadius: 16, border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {imgFailed[artIdx - 1] ? (
                  <div style={{ padding: '12vh 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 48 }}>{artIdx === 1 ? '🛠️' : '🤝'}</div>
                    <div style={{ fontSize: 15, color: '#c4b5fd', marginTop: 8 }}>{artIdx === 1 ? '把 AI 当工具（过去）' : '把 AI 当伙伴（未来）'}</div>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artImg} alt={`A0-${artIdx}`} style={{ width: '100%', objectFit: 'contain', maxHeight: '52vh' }} onError={() => setImgFailed((f) => f.map((v, j) => (j === artIdx - 1 ? true : v)))} />
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>第 {artIdx} / 2 张 · 教师可切换</div>
            </div>
            <div className="a0-sliders-chart">
              <div className="a0-sliders-chart-title">全班 6 步 · 人机分工分布</div>
              {(sliders?.byStep ?? []).map((s) => (
                <div key={s.label} className="a0-slider-bar-row">
                  <div className="a0-slider-bar-label">{s.label}</div>
                  <div className="a0-slider-bar-track">
                    <span className="a0-slider-bar-seg a0-human" style={{ flex: s.buckets[0] }} title={`偏人 ${s.buckets[0]} 人`}>{s.buckets[0] > 0 ? s.buckets[0] : ''}</span>
                    <span className="a0-slider-bar-seg a0-mid" style={{ flex: s.buckets[1] }} title={`中间 ${s.buckets[1]} 人`}>{s.buckets[1] > 0 ? s.buckets[1] : ''}</span>
                    <span className="a0-slider-bar-seg a0-ai" style={{ flex: s.buckets[2] }} title={`偏AI ${s.buckets[2]} 人`}>{s.buckets[2] > 0 ? s.buckets[2] : ''}</span>
                  </div>
                </div>
              ))}
              <div className="a0-sliders-chart-legend">
                <span><i className="lg lg-human" />偏人</span>
                <span><i className="lg lg-mid" />中间</span>
                <span><i className="lg lg-ai" />偏AI</span>
              </div>
            </div>
          </div>
          <div className="a0-next">大家滑完提交后，我们进入下一个环节</div>
          <ContentSlot slot="a0_slider_after" />
        </>
      )}

      <ContentSlot slot="a0_reveal_after" />
    </div>
  );
}
