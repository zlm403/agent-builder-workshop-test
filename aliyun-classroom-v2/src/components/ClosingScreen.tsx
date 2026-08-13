'use client';

import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import { CLOSING_BEATS, CLOSING_QUESTIONS, QINGWU, type GapRow } from '@/lib/closingConfig';
import type { ClosingAnswer } from '@/lib/closing';
import ClosingQAScreen from '@/components/ClosingQAScreen';
import ContentSlot from './ContentSlot';

const C = {
  bg: '#0b1120',
  panel: 'linear-gradient(180deg,#111a2e,#16213a)',
  line: '#26324d',
  txt: '#e2e8f0',
  sub: '#94a3b8',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#38bdf8',
  purple: '#a78bfa',
};

const cardStyle: CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.line}`,
  borderRadius: 18,
  padding: '22px 24px',
};

function Kicker({ children }: { children: ReactNode }) {
  return <div style={{ color: C.blue, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>{children}</div>;
}
function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 18px', letterSpacing: '.5px', lineHeight: 1.35 }}>{children}</h2>;
}
function Sub({ children }: { children: ReactNode }) {
  return <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.7, maxWidth: 820, margin: 0 }}>{children}</p>;
}
function Points({ items }: { items: string[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 17, color: C.txt, lineHeight: 1.5 }}>
            <span style={{ color: C.blue, fontWeight: 800, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedBeat({ answers }: { answers: ClosingAnswer[] }) {
  const tally = (qid: string) => answers.filter((a) => a.questionId === qid);
  const qmark: CSSProperties = {
    width: 96, height: 96, borderRadius: '50%',
    background: 'rgba(56,189,248,.12)', border: `2px solid ${C.blue}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 52, fontWeight: 800, color: C.blue,
  };
  return (
    <>
      <Kicker>提问导入</Kicker>
      <div style={cardStyle}>
        <div style={qmark}>?</div>
        <H2>你为什么需要 AI？你为什么想学 AI？</H2>
        <Sub>这三道题已经推到你的手机 — 现在就选，讲师会优先讲大家最关心的。</Sub>
      </div>
      <div style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: 18, margin: '0 0 14px', color: C.txt }}>问题实时统计（{answers.length} 条回答）</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
          {CLOSING_QUESTIONS.map((q) => {
            const items = tally(q.id);
            return (
              <div key={q.id} style={{ ...cardStyle, padding: 18 }}>
                <div style={{ fontSize: 14, color: C.txt, fontWeight: 600, marginBottom: 12, minHeight: 42, lineHeight: 1.4 }}>{q.q}</div>
                {q.type === 'single' || q.type === 'multi' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {q.options!.map((opt) => {
                      const n = items.filter((a) => (a.values ?? []).includes(opt)).length;
                      const pct = items.length ? Math.round((n / items.length) * 100) : 0;
                      return (
                        <div key={opt}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                            <span style={{ color: C.txt }}>{opt}</span>
                            <span style={{ color: C.sub }}>{n} · {pct}%</span>
                          </div>
                          <div style={{ height: 8, background: 'rgba(148,163,184,.18)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: C.blue }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
                    {items.length === 0 ? (
                      <span style={{ fontSize: 13, color: C.sub }}>还没有人填写…</span>
                    ) : items.map((a) => (
                      <div key={`${a.questionId}-${a.ts}`} style={{ fontSize: 13, color: C.txt, background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                        {a.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SolutionBeat({ screen, gapTable, answers }: { screen: string[]; gapTable: GapRow[]; answers: ClosingAnswer[] }) {
  const q3Answers = answers.filter((a) => a.questionId === 'q3');
  const countFor = (opt?: string) => (opt ? q3Answers.filter((a) => (a.values ?? []).includes(opt)).length : 0);
  const th: CSSProperties = { padding: '14px 18px', fontSize: 14, fontWeight: 800, color: C.blue, letterSpacing: '.5px' };
  const td: CSSProperties = { padding: '16px 18px', fontSize: 15, color: C.txt, lineHeight: 1.6, borderLeft: `1px solid ${C.line}` };
  return (
    <>
      <Kicker>问题与解决方案对应</Kicker>
      <H2>你想做的项目不一样，但需要补齐的能力很相似</H2>
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.45fr 1.45fr', background: 'rgba(56,189,248,.08)', borderBottom: `1px solid ${C.line}` }}>
          <div style={th}>你现在缺什么</div>
          <div style={th}>正式课给你的方法</div>
          <div style={{ ...th, borderLeft: `1px solid ${C.line}` }}>顷悟平台给你的工具</div>
        </div>
        {gapTable.map((r, i) => {
          const n = countFor(r.q3opt);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.45fr 1.45fr', borderBottom: i < gapTable.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ ...td, borderLeft: 'none', fontWeight: 700 }}>
                <div>{r.gap}</div>
                {n > 0 && (
                  <div style={{ marginTop: 8, display: 'inline-block', fontSize: 12, fontWeight: 700, color: C.green, background: 'rgba(34,197,94,.12)', borderRadius: 999, padding: '3px 10px' }}>{n} 人也在卡这里</div>
                )}
              </div>
              <div style={td}>{r.course}</div>
              <div style={td}>{r.platform}</div>
            </div>
          );
        })}
      </div>
      {screen.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Points items={screen} />
        </div>
      )}
    </>
  );
}

function CourseBeat({ projects, screen }: { projects: { period: string; name: string; desc: string; skills: string[] }[]; screen: string[] }) {
  return (
    <>
      <Kicker>正式课</Kicker>
      <H2>一天 AI 应用实战课</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
        {projects.map((p, i) => (
          <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, color: i === 2 ? C.purple : C.blue, fontWeight: 800, letterSpacing: '.5px' }}>{p.period}</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: '8px 0 10px', lineHeight: 1.3 }}>{p.name}</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.65 }}>{p.desc}</div>
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {p.skills.map((s, j) => (
                <span key={j} style={{ fontSize: 12, color: C.txt, background: 'rgba(56,189,248,.12)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '4px 11px' }}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {screen.length > 0 && <div style={{ marginTop: 18 }}><Points items={screen} /></div>}
    </>
  );
}

function PlatformBeat({ screen, demoSteps }: { screen: string[]; demoSteps: string[] }) {
  return (
    <>
      <Kicker>顷悟平台</Kicker>
      <H2>讲师现场演示 · 请看大屏</H2>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, margin: '4px 0 22px' }}>
        {demoSteps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.blue, background: 'rgba(56,189,248,.1)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '8px 16px' }}>{s}</div>
            {i < demoSteps.length - 1 && <div style={{ color: C.line, padding: '0 10px', fontSize: 20 }}>→</div>}
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, textAlign: 'center', padding: '44px 24px' }}>
        <div style={{ fontSize: 18, color: C.txt, fontWeight: 700, marginBottom: 12 }}>讲师正在演示顷悟平台</div>
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.8, maxWidth: 640, margin: '0 auto' }}>{screen[0]}</div>
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.8, maxWidth: 640, margin: '12px auto 0' }}>{screen[1]}</div>
      </div>
    </>
  );
}

function QrPlaceholder({ big = false }: { big?: boolean }) {
  const size = big ? 220 : 140;
  const N = 25;
  const mods: { x: number; y: number }[] = [];
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const border = x === 0 || x === 6 || y === 0 || y === 6;
      const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (border || inner) mods.push({ x: ox + x, y: oy + y });
    }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  let seed = 99173;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const occupied = (x: number, y: number) => mods.some((m) => m.x === x && m.y === y);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (occupied(x, y)) continue;
    const inZone = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    if (inZone) continue;
    if (rnd() > 0.55) mods.push({ x, y });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size, height: size, background: '#fff', borderRadius: 12, padding: 8, boxShadow: '0 6px 22px rgba(0,0,0,.35)' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${N} ${N}`}>
          {mods.map((m, i) => <rect key={i} x={m.x} y={m.y} width={1} height={1} fill="#0b1120" />)}
        </svg>
      </div>
      <div style={{ fontSize: big ? 15 : 13, color: C.sub, fontWeight: 600 }}>扫码查看详情并报名</div>
    </div>
  );
}

function PriceBeat({ screen }: { screen: string[] }) {
  return (
    <>
      <Kicker>价格与报名</Kicker>
      <H2>一天 AI 应用实战课 · 299 元</H2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Points items={screen} />
          <div style={{ marginTop: 18, fontSize: 13, color: C.sub, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            平台额度、后续费用、作品保留、退款及改期规则，以报名页公示为准。
          </div>
        </div>
        <div style={{ flexShrink: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', marginBottom: 4 }}>¥299</div>
          <div style={{ marginBottom: 16, fontSize: 13, color: C.sub }}>限试听课当场</div>
          <QrPlaceholder />
        </div>
      </div>
    </>
  );
}

function SummaryBeat({ screen }: { screen: string[] }) {
  return (
    <>
      <Kicker>最终总结</Kicker>
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <H2>从一个想法，到一个经过测试并正式发布的 AI 应用第一版</H2>
          <Points items={screen} />
        </div>
        <div style={{ flexShrink: 0 }}>
          <QrPlaceholder big />
        </div>
      </div>
    </>
  );
}

function QaBeat({ screen }: { screen: string[] }) {
  return (
    <>
      <Kicker>集中答疑</Kicker>
      <H2>把你剩下的疑问，当场讲掉</H2>
      <Sub>手机勾选你最关心的，讲师按选择人数优先现场讲；排名靠后的，手机端看预制答案。</Sub>
      <div style={{ marginTop: 18 }}>
        <Points items={screen} />
      </div>
    </>
  );
}

export default function ClosingScreen({
  sessionId: propSession,
  beatIdx: propBeat,
}: {
  sessionId?: string;
  beatIdx?: number;
} = {}) {
  const [qSession, setQSession] = useState('');
  const beatIdx = typeof propBeat === 'number' ? propBeat : 0;
  const [answers, setAnswers] = useState<ClosingAnswer[]>([]);
  const [enroll, setEnroll] = useState(0);

  useEffect(() => {
    if (propSession) {
      setQSession(propSession);
      return;
    }
    const p = new URLSearchParams(window.location.search);
    setQSession(p.get('sessionId') ?? '');
  }, [propSession]);

  const loadAnswers = useCallback(async () => {
    if (!qSession) return;
    try {
      const r = await fetch(`/api/closing/answer?sessionId=${qSession}`);
      const d = await r.json();
      if (Array.isArray(d.answers)) setAnswers(d.answers);
    } catch {
      /* ignore */
    }
  }, [qSession]);

  const loadEnroll = useCallback(async () => {
    if (!qSession) return;
    try {
      const r = await fetch(`/api/closing/enroll?sessionId=${qSession}`);
      const d = await r.json();
      if (typeof d.count === 'number') setEnroll(d.count);
    } catch {
      /* ignore */
    }
  }, [qSession]);

  useEffect(() => {
    if (!qSession) return;
    loadAnswers();
    loadEnroll();
    const t = setInterval(() => {
      loadAnswers();
      loadEnroll();
    }, 2500);
    return () => clearInterval(t);
  }, [qSession, loadAnswers, loadEnroll]);

  const beat = CLOSING_BEATS[beatIdx];
  const key = beat.key;

  let body: ReactNode = null;
  if (key === 'need') body = <NeedBeat answers={answers} />;
  else if (key === 'solution') body = <SolutionBeat screen={beat.screen} gapTable={beat.gapTable ?? []} answers={answers} />;
  else if (key === 'course') body = <CourseBeat projects={beat.projects ?? []} screen={beat.screen} />;
  else if (key === 'platform') body = <PlatformBeat screen={beat.screen} demoSteps={beat.demoSteps ?? []} />;
  else if (key === 'price') body = <PriceBeat screen={beat.screen} />;
  else if (key === 'qa') body = <QaBeat screen={beat.screen} />;
  else if (key === 'summary') body = <SummaryBeat screen={beat.screen} />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.txt, fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', padding: '24px 32px 40px' }}>
      <ContentSlot slot="finale_top" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>我的<span style={{ color: C.yellow }}>AI</span>公司</div>
          <div style={{ fontSize: 13, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 999, padding: '4px 12px' }}>收官 · 试听课最后 30 分钟</div>
        </div>
        <div style={{ fontSize: 14, color: C.sub }}>
          已报名 <b style={{ color: C.green, fontSize: 18 }}>{enroll}</b> 人
        </div>
      </div>

      {body}

      <ContentSlot slot="finale_after" />

      {/* 集中答疑解答层：讲师点「我要讲这个」后全屏覆盖显示，平时返回 null */}
      <ClosingQAScreen sessionId={qSession} />
    </div>
  );
}
