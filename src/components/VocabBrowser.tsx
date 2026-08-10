import { useState } from 'react';
import { VOCAB_DAYS, VOCAB_TOTAL, VOCAB_DAILY } from '@/lib/vocab';

// 学生端「四级词汇 400 词库」浏览弹层：
// 从 A01 任务资料区「查看词库」打开；按 Day 1-10 分组展示，默认展开第 1 天。
export default function VocabBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([1]));

  if (!open) return null;

  function toggleDay(day: number) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a', borderRadius: 14, width: '94%', maxWidth: 880,
          maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>四级词汇 400 词库</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              {VOCAB_TOTAL} 词 · 10 天 × 每天 {VOCAB_DAILY} 词 · 点击「引用」可把整份词库放进对话框
            </div>
          </div>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: '6px 16px', borderRadius: 8, fontSize: 13 }}
          >
            关闭
          </button>
        </div>

        <div style={{ overflow: 'auto', padding: '6px 18px 20px', flex: 1 }}>
          {VOCAB_DAYS.map((g) => {
            const expanded = openDays.has(g.day);
            return (
              <div key={g.day} style={{ marginTop: 10 }}>
                <button
                  onClick={() => toggleDay(g.day)}
                  style={{
                    width: '100%', textAlign: 'left', background: '#1e293b',
                    border: '1px solid #334155', borderRadius: 8, padding: '10px 14px',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', color: '#e2e8f0',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Day {g.day} · {g.words.length} 词</span>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{expanded ? '收起 ▲' : '展开 ▼'}</span>
                </button>
                {expanded && (
                  <div style={{
                    marginTop: 6, background: '#1a2233', borderRadius: 8,
                    border: '1px solid #2b3650', overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '120px 150px 1fr',
                      gap: 8, padding: '8px 14px', fontSize: 11, color: '#64748b',
                      borderBottom: '1px solid #2b3650', fontWeight: 700,
                    }}>
                      <span>单词</span>
                      <span>音标</span>
                      <span>释义 / 例句</span>
                    </div>
                    {g.words.map((w) => (
                      <div key={w.w} style={{
                        display: 'grid', gridTemplateColumns: '120px 150px 1fr',
                        gap: 8, padding: '7px 14px', borderBottom: '1px solid rgba(43,54,80,0.6)',
                        fontSize: 13, alignItems: 'baseline',
                      }}>
                        <span style={{ color: '#fbbf24', fontWeight: 700 }}>{w.w}</span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>{w.p}</span>
                        <span style={{ color: '#e2e8f0' }}>{w.d} <span style={{ color: '#7dd3fc', fontSize: 12 }}>· {w.e}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
