'use client';
import { api } from '@/lib/basePath';
// =========================================================
// 教师端设置：教室笔记本视频服务器地址（运行时配置）
// 存服务器文件 data/video-server.txt，保存后全局生效，无需重新构建/重启端页面。
// 填的是笔记本本地服务的基址，如 http://192.168.1.20:9123。
// 这是教师端内部工具，可出现「视频服务器」这类内部名称（铁律仅面向学生/大屏隐藏编号）。
// =========================================================
import { useEffect, useState } from 'react';

export default function VideoServerSettings() {
  const [base, setBase] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api('/api/video-server'), { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          if (typeof d?.base === 'string') setBase(d.base);
        }
      } catch {
        /* noop：没配上就空白，不影响其它功能 */
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch(api('/api/video-server'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base: base.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) {
        alert(`保存失败：${d.error?.message || d.error || r.statusText}`);
        return;
      }
      if (typeof d?.base === 'string') setBase(d.base);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: 200,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e2e8f0',
    fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '4px 10px' }}>
      <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>视频服务器地址</span>
      <input
        value={base}
        onChange={(e) => setBase(e.target.value)}
        placeholder="http://笔记本IP:9123"
        title="留空 = 不配置，视频自动走公网"
        style={inputStyle}
      />
      <button
        onClick={save}
        disabled={busy || !base.trim()}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #334155',
          background: saved ? 'rgba(34,197,94,0.15)' : '#1e293b',
          color: saved ? '#86efac' : '#e2e8f0',
          cursor: busy || !base.trim() ? 'default' : 'pointer',
          opacity: busy || !base.trim() ? 0.5 : 1,
        }}
      >
        {busy ? '保存中…' : saved ? '已保存 ✓' : '保存'}
      </button>
    </div>
  );
}