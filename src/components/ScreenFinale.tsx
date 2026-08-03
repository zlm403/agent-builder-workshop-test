'use client';

import { useEffect, useRef, useState } from 'react';
import { SCENE_LABEL, SCENE_ICON } from '@/lib/finaleConfig';

type AgentMini = { role: string; nickname: string };
type CompanyItem = {
  id: string;
  name: string;
  scene: string;
  ownerName: string | null;
  agents: AgentMini[];
};
type Activity = { workingIndex: number | null; doneSteps: number[]; done: boolean };

export default function ScreenFinale({ sessionId }: { sessionId: string }) {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const esRef = useRef<EventSource | null>(null);

  async function loadCompanies() {
    try {
      const r = await fetch(`/api/finale/state?sessionId=${sessionId}`);
      const d = await r.json();
      if (Array.isArray(d.companies)) setCompanies(d.companies);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    loadCompanies();
    const poll = setInterval(loadCompanies, 3000);

    const es = new EventSource(`/api/events/${sessionId}`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'finale:working') {
          const p = evt.payload || {};
          setActivity((a) => ({ ...a, [p.companyId]: { workingIndex: p.stepIndex, doneSteps: [], done: false } }));
        } else if (evt.type === 'finale:step') {
          const p = evt.payload || {};
          setActivity((a) => {
            const cur = a[p.companyId] || { workingIndex: null, doneSteps: [], done: false };
            return {
              ...a,
              [p.companyId]: { ...cur, workingIndex: null, doneSteps: [...new Set([...cur.doneSteps, p.stepIndex])] },
            };
          });
        } else if (evt.type === 'finale:done') {
          const p = evt.payload || {};
          setActivity((a) => ({ ...a, [p.companyId]: { ...(a[p.companyId] || { doneSteps: [] }), done: true, workingIndex: null } }));
        }
      } catch {
        /* noop */
      }
    };

    return () => {
      clearInterval(poll);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="screen-finale">
      <div className="sf-head">
        <h1>🏢 一人公司 · 实时作战大屏</h1>
        <div className="sf-sub">每个产品 = 4 个 Agent 自动协作。亮起即工作中，✅ 表示完成。</div>
      </div>

      {companies.length === 0 ? (
        <div className="sf-empty">等待学生发布产品…（教师在「终章模式」点「开放本轮发布」后，学生发布即出现在此）</div>
      ) : (
        <div className="sf-grid">
          {companies.map((c) => {
            const act = activity[c.id] || { workingIndex: null, doneSteps: [], done: false };
            return (
              <div key={c.id} className={`sf-company ${act.done ? 'done' : ''}`}>
                <div className="sfc-top">
                  <span className="sfc-scene">
                    {SCENE_ICON[c.scene]} {SCENE_LABEL[c.scene]}
                  </span>
                  <span className="sfc-name">{c.name}</span>
                </div>
                <div className="sfc-owner">by {c.ownerName || '匿名同学'}</div>
                <div className="sfc-agents">
                  {c.agents.map((a, i) => {
                    const st = act.doneSteps.includes(i) ? 'done' : act.workingIndex === i ? 'working' : 'waiting';
                    return (
                      <div key={i} className={`sf-node ${st}`}>
                        <span className="sfn-idx">{i + 1}</span>
                        <span className="sfn-name">{a.nickname || a.role}</span>
                        <span className="sfn-state">
                          {st === 'done' ? '✅' : st === 'working' ? '🟢' : '⏳'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {act.done && <div className="sfc-badge">交付完成 ✓</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
