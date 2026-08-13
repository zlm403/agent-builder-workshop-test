'use client';

import { useEffect, useState } from 'react';
import { SCENE_LABEL, SCENE_ICON, FUNNEL_STAGES } from '@/lib/finaleConfig';

type CompanyItem = {
  id: string;
  name: string;
  scene: string;
  ownerName: string | null;
  agents: { role: string; nickname: string }[];
};

type ScreeningRow = { anonymousId: string; answer: string; label: string };
type ScreeningData = { total: number; submitted: number; labels: { tool_user: number; task_solver: number; app_creator: number }; rows: ScreeningRow[] };

type FunnelData = Record<string, number>;

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
  // 模块锁：进入 A07 自动锁，教师点"解锁"学生才能自由玩
  const [locked, setLocked] = useState(true);
  const [funnel, setFunnel] = useState<FunnelData>({});

  async function load() {
    const r = await fetch(`/api/finale/state?sessionId=${sessionId}`);
    const d = await r.json();
    setActive(!!d.active);
    setRound(d.round ?? 0);
    setOpen(!!d.open);
    if (Array.isArray(d.companies)) setCompanies(d.companies);
    if (d.funnel) setFunnel(d.funnel);
    // 读模块锁状态
    try {
      const cs = await fetch(`/api/classroom/${sessionId}`);
      const csd = await cs.json();
      setLocked(csd.summary?.moduleLocked ?? false);
    } catch {
      /* ignore */
    }
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

  // finale 控制（进入/开放发布/关闭本轮/退出）
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
            ? '已进入一人公司，学生端已自动锁定。大屏讲解，讲完点「解锁」让学生自由玩。'
            : action === 'open'
              ? `第 ${d.round} 轮已开放发布。`
              : action === 'close'
                ? '本轮已关闭，学生不能再发布。'
                : '已退出，学生回到常规环节。'
        );
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  // 模块锁定/解锁（控学生端能不能动）
  async function lockCtrl(nextLocked: boolean) {
    setBusy(true);
    setToast('');
    try {
      await fetch(`/api/classroom/${sessionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', locked: nextLocked }),
      });
      setToast(
        nextLocked
          ? '已锁定，学生端动不了。'
          : '已解锁，学生可以自由玩了——一路走到底，中间不再有锁。'
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <div className="finale-tc-head">
        <div>
          <div className="finale-kicker">教师导演台</div>
          <h2>一人公司 · 控制台</h2>
        </div>
        <button className="secondary" onClick={onClose}>
          返回常规课堂 →
        </button>
      </div>

      <div className="card">
        <div className="tc-state">
          <span className={`pill ${active ? 'green' : 'gray'}`}>{active ? '进行中' : '未进入'}</span>
          <span className={`pill ${locked ? 'yellow' : 'green'}`}>{locked ? '已锁定' : '已解锁'}</span>
          <span className="pill gray">第 {round} 轮</span>
          <span className={`pill ${open ? 'yellow' : 'gray'}`}>{open ? '发布开放中' : '发布已关闭'}</span>
          <span className="pill blue">已发布 {companies.length} 个</span>
        </div>

        <div className="tc-guide">
          <b>流程：</b>① 点「进入」→ 学生端自动锁定，看大屏讲解 → ② 讲完点「解锁」→ 学生自由玩到底（选公司→招专家→前台→开业→收款→分享）→ ③ 玩完点「锁定」停下来，或点「退出」推进到收尾环节。
        </div>

        <div className="tc-buttons">
          {!active && (
            <button className="primary" disabled={busy} onClick={() => ctrl('enter')}>
              进入
            </button>
          )}
          {active && (
            <>
              {locked ? (
                <button className="primary" disabled={busy} onClick={() => lockCtrl(false)}>
                  🔓 解锁（让学生自由玩）
                </button>
              ) : (
                <button className="secondary" disabled={busy} onClick={() => lockCtrl(true)}>
                  🔒 锁定（让学生停下来）
                </button>
              )}
              <button className="secondary" disabled={busy || open} onClick={() => ctrl('open')}>
                {open ? '发布已开放' : '开放本轮发布'}
              </button>
              <button className="secondary" disabled={busy || !open} onClick={() => ctrl('close')}>
                关闭本轮
              </button>
              <button className="danger" disabled={busy} onClick={() => ctrl('exit')}>
                退出 → 推进到收尾
              </button>
            </>
          )}
        </div>

        {toast ? <p className="finale-warn">{toast}</p> : null}

        <div className="tc-links">
          <a href={`/screen?sessionId=${sessionId}`} target="_blank" rel="noreferrer">
            <button className="secondary">打开大屏（讲解态 / 作战态）</button>
          </a>
        </div>
      </div>

      {/* 全班进度漏斗 */}
      {active && (
        <div className="card">
          <h3>全班进度</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {FUNNEL_STAGES.map((st, i) => {
              const cnt = funnel[st.key] || 0;
              return (
                <div key={st.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                    background: '#22c55e', color: '#06210f',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1 }}>{st.label}</span>
                  <span style={{ fontWeight: 800, minWidth: 40, textAlign: 'right' }}>{cnt} 人</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3>已发布的产品（第 {round} 轮）</h3>
        {companies.length === 0 ? (
          <p className="note">还没有人发布。学生完成公司组建后会自动出现。</p>
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
          <h3>A0 学员明细（标签环节 · 匿名）</h3>
          {!screening ? (
            <p className="note">正在加载 A0 标签数据…</p>
          ) : (
            <>
              <div className="tc-state">
                <span className="pill blue">{screening.submitted} 人已提交</span>
                <span className="pill yellow">AI 路人 {screening.labels.tool_user}</span>
                <span className="pill blue">AI 搭子 {screening.labels.task_solver}</span>
                <span className="pill green">AI 合伙人 {screening.labels.app_creator}</span>
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
                            {r.label === 'app_creator' ? 'AI 合伙人' : r.label === 'task_solver' ? 'AI 搭子' : 'AI 路人'}
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
