'use client';

import { useEffect, useState } from 'react';
import { SCENE_LABEL, SCENE_ICON } from '@/lib/finaleConfig';

type CompanyItem = {
  id: string;
  name: string;
  scene: string;
  ownerName: string | null;
  agents: { role: string; nickname: string }[];
};

type ScreeningRow = { anonymousId: string; answer: string; label: string };
type ScreeningData = { total: number; submitted: number; labels: { tool_user: number; task_solver: number; app_creator: number }; rows: ScreeningRow[] };

export default function TeacherFinale({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [active, setActive] = useState(false);
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [screening, setScreening] = useState<ScreeningData | null>(null);

  async function load() {
    const r = await fetch(`/api/finale/state?sessionId=${sessionId}`);
    const d = await r.json();
    setActive(!!d.active);
    setRound(d.round ?? 0);
    setOpen(!!d.open);
    if (Array.isArray(d.companies)) setCompanies(d.companies);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    let closed = false;
    (async () => {
      try {
        const r = await fetch(`/api/screening/analytics?sessionId=${sessionId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!closed && d.screening) setScreening(d.screening);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      closed = true;
    };
  }, [active, round, sessionId]);

  async function ctrl(action: string) {
    setBusy(true);
    setToast('');
    try {
      const res = await fetch('/api/finale/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action }),
      });
      const d = await res.json();
      if (d.error) {
        setToast(d.error.message || '操作失败');
      } else {
        setActive(d.active);
        setRound(d.round);
        setOpen(d.open);
        setToast(
          action === 'enter'
            ? '已进入终章，学生端已切换。现在让他们搭建产品。'
            : action === 'open'
              ? `第 ${d.round} 轮已开放发布，叫学生点「发布」。`
              : action === 'close'
                ? '本轮已关闭，学生不能再发布。可让他们去体验别人的产品。'
                : '已退出终章，学生回到常规环节。'
        );
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="finale-tc-head">
        <div>
          <div className="finale-kicker">教师导演台 · 终章</div>
          <h2>一人公司 · 多 Agent 协同控制台</h2>
        </div>
        <button className="secondary" onClick={onClose}>
          返回常规课堂 →
        </button>
      </div>

      <div className="card">
        <div className="tc-state">
          <span className={`pill ${active ? 'green' : 'gray'}`}>{active ? '终章进行中' : '未进入终章'}</span>
          <span className="pill gray">第 {round} 轮</span>
          <span className={`pill ${open ? 'yellow' : 'gray'}`}>{open ? '发布开放中' : '发布已关闭'}</span>
          <span className="pill blue">已发布 {companies.length} 个</span>
        </div>

        <div className="tc-guide">
          <b>流程：</b>① 点「进入终章」→ 学生开始搭建 4-Agent 产品 → ② 点「开放本轮发布」并喊“现在发布”→
          学生点发布 → ③ 时间到 → 点「关闭本轮」→ 学生去体验别人的产品 → ④ 想让另一批人当“搭建者”，再点「开放本轮发布」（轮次+1，新的同学发布）。
        </div>

        <div className="tc-buttons">
          {!active && (
            <button className="primary" disabled={busy} onClick={() => ctrl('enter')}>
              进入终章
            </button>
          )}
          {active && (
            <>
              <button className="primary" disabled={busy || open} onClick={() => ctrl('open')}>
                {open ? '发布已开放' : '开放本轮发布'}
              </button>
              <button className="secondary" disabled={busy || !open} onClick={() => ctrl('close')}>
                关闭本轮（停止发布）
              </button>
              <button className="danger" disabled={busy} onClick={() => ctrl('exit')}>
                退出终章
              </button>
            </>
          )}
        </div>

        {toast ? <p className="finale-warn">{toast}</p> : null}

        <div className="tc-links">
          <a href={`/screen?sessionId=${sessionId}`} target="_blank" rel="noreferrer">
            <button className="secondary">打开大屏（实时闪烁 Agent）</button>
          </a>
        </div>
      </div>

      <div className="card">
        <h3>已发布的产品（第 {round} 轮）</h3>
        {companies.length === 0 ? (
          <p className="note">还没有人发布。开放发布后，学生填完属性卡点「发布」即可出现在这里。</p>
        ) : (
          <div className="tc-company-list">
            {companies.map((c) => (
              <div key={c.id} className="tc-company">
                <div className="tcc-scene">
                  {SCENE_ICON[c.scene]} {SCENE_LABEL[c.scene]}
                </div>
                <div className="tcc-name">{c.name}</div>
                <div className="tcc-owner">by {c.ownerName || '匿名同学'}</div>
                <div className="tcc-agents">
                  {c.agents.map((a, i) => (
                    <span key={i} className="tcc-agent">
                      {i + 1}.{a.nickname || a.role}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div className="card">
          <h3>A0 学员明细（面试环节 · 匿名）</h3>
          {!screening ? (
            <p className="note">正在加载 A0 面试数据…</p>
          ) : (
            <>
              <div className="tc-state">
                <span className="pill blue">{screening.submitted} 人已提交</span>
                <span className="pill yellow">工具体验者 {screening.labels.tool_user}</span>
                <span className="pill blue">任务解决者 {screening.labels.task_solver}</span>
                <span className="pill green">应用创造者 {screening.labels.app_creator}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tc-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>标签</th>
                      <th>回答摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screening.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{r.anonymousId}</td>
                        <td>
                          <span className={`pill ${r.label === 'app_creator' ? 'green' : r.label === 'task_solver' ? 'blue' : 'yellow'}`}>
                            {r.label === 'app_creator' ? '应用创造者' : r.label === 'task_solver' ? '任务解决者' : '工具体验者'}
                          </span>
                        </td>
                        <td>{r.answer.length > 60 ? r.answer.slice(0, 60) + '…' : r.answer}</td>
                      </tr>
                    ))}
                    {screening.rows.length === 0 && (
                      <tr><td colSpan={3} className="note">等待学生提交…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
