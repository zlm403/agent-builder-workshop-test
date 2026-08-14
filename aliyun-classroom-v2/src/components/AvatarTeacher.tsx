'use client';
// =========================================================
// A0 + A1 + P2 + P3 · 教师端环节页面序列控制（PPT 式）
// 每个环节由一串"页"组成：内置功能页（三问/判定/揭晓/滑块/共生缸…）+ 内容页（文字/图/视频/链接/网页）
// 教师点某页 = 大屏切到该页；任意两页间可"插入新页"；每页可编辑/隐藏/上移/下移/删除（内置页不可删）。
// 数据在 /api/pages，页面序列存在 DB，教师自助增删排序，无需改代码。
// =========================================================
import { useCallback, useEffect, useState } from 'react';

// 模块 → 组 映射（纯函数，客户端内联，避免 import 含 prisma 的服务端模块）
function groupOfModule(moduleId: string | null | undefined): 'A0' | 'A1' | 'P2' | 'P3' | null {
  if (!moduleId) return null;
  if (moduleId.startsWith('A0N_')) return 'A0';
  if (moduleId === 'A1_AVATAR') return 'A1';
  if (moduleId === 'P2_SITE') return 'P2';
  if (moduleId === 'P3_GAME') return 'P3';
  return null;
}

interface PageDef {
  id: string;
  group: string;
  moduleId: string;
  seq: number;
  kind: 'builtin' | 'content';
  refKey: string | null;
  title: string | null;
  overrides?: Record<string, string> | null;
  hidden: boolean;
}

const BUILTIN_LABEL: Record<string, string> = {
  // A0
  'a0:intro1': '开场·手指图',
  'a0:intro2': '开场·发展图',
  'reveal:1': '揭晓结果',
  'reveal:2': '三种形态',
  'reveal:3': '工具/伙伴两图',
  'a0:mirror': '我们在哪儿',
  'a0:closing': '收束·已经来了',
  // A1
  'avatar:hook': '钩子开场',
  'avatar:wall': '作品墙',
  'avatar:cog': '认知对比图',
  'avatar:video': '视频·普通人的例子',
  // P2
  'p2:hook': '钩子开场',
  'p2:wall': '作品墙',
  // P3
  'p3:hook': '钩子开场',
  'p3:wall': '共生缸',
};

// A1 十七环节名（c1..c17）
const A1_CN: Record<string, string> = {
  c1: '发现问题', c2: '发布任务', c3: '选择真实任务', c4: 'AI 采访',
  c5: '补充真实样本', c6: '生成分身档案', c7: '校准档案', c8: '第一次写朋友圈',
  c9: '判断像不像', c10: '调整', c11: '最终验收', c12: '保存分身',
  c13: '梦想', c14: '一个到一群', c15: '分析', c16: '现实与紧迫', c17: '结论',
};
const P2_CN: Record<string, string> = {
  s1: '发布任务', s2: '明确目标', s3: '获取领域地图', s4: '判断与收缩',
  s5: '生成可用内容', s6: '生成网页', s7: '第一轮自检', s8: '同伴测试',
  s9: '根据反馈修改', s10: '能力迁移', s11: '提交与成果', s12: '升华',
};
const P3_CN: Record<string, string> = {
  s1: '空世界', s2: '核心特质', s3: '设计规则', s4: 'AI翻译生成', s5: '投入共生缸',
  s6: '观察', s7: '修改', s8: '二次运行', s9: '创造过程卡', s10: '认知收束',
};

function pageLabel(p: PageDef): string {
  if (p.kind === 'content') return p.title || '新页面';
  if (p.refKey === null) {
    // 模块默认态：A0N_QUESTIONS→三问，A0N_VOTE→系统判定
    if (p.moduleId === 'A0N_QUESTIONS') return '三问';
    if (p.moduleId === 'A0N_VOTE') return '系统判定';
    return '默认';
  }
  if (BUILTIN_LABEL[p.refKey]) return BUILTIN_LABEL[p.refKey];
  const m = p.refKey.match(/^avatar:(c\d+)$/);
  if (m) return A1_CN[m[1]] ?? p.refKey;
  const m2 = p.refKey.match(/^p2:(s\d+)$/);
  if (m2) return P2_CN[m2[1]] ?? p.refKey;
  const m3 = p.refKey.match(/^p3:(s\d+)$/);
  if (m3) return P3_CN[m3[1]] ?? p.refKey;
  return p.refKey;
}

export default function AvatarTeacher({
  moduleId,
  subState,
  busy,
  control,
  onEditContent,
  onEditText,
}: {
  moduleId: string;
  subState: string | null;
  busy: boolean;
  control: (action: string, payload?: any) => void;
  onEditContent: (pageId: string) => void;
  onEditText: (page: PageDef) => void;
}) {
  const [pages, setPages] = useState<PageDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [busyLocal, setBusyLocal] = useState(false);
  const group = groupOfModule(moduleId);

  const load = useCallback(async () => {
    if (!group) return;
    try {
      const r = await fetch(`/api/pages?group=${group}`);
      const d = await r.json();
      if (d.pages) setPages(d.pages);
    } catch { /* noop */ }
  }, [group]);

  useEffect(() => { load(); }, [load]);

  if (!group) return null;

  // 当前高亮页：内置页比对 refKey，内容页比对 page:{id}
  function isActive(p: PageDef): boolean {
    if (p.kind === 'content') return subState === `page:${p.id}`;
    if (p.refKey === null) {
      // 模块默认态：当前模块等于该页模块，且 subState 为空或不是该模块的内置 subState
      if (moduleId !== p.moduleId) return false;
      const s = String(subState ?? '');
      if (s === '' || s === 'null') return true;
      // 若 subState 是别的内置页，则不是默认态
      const builtins = pages.filter((x) => x.moduleId === p.moduleId && x.refKey !== null);
      return !builtins.some((x) => s === x.refKey);
    }
    return moduleId === p.moduleId && subState === p.refKey;
  }

  function go(page: PageDef) {
    if (busy || busyLocal) return;
    // 隐藏页不允许投大屏（防止"点了隐藏页大屏却显示"）
    if (page.hidden) return;
    if (page.moduleId !== moduleId) {
      // 跨模块（A0 三个模块之间）：jump 并落到指定 subState
      control('jump', { targetModuleId: page.moduleId, subState: page.kind === 'content' ? `page:${page.id}` : page.refKey ?? null });
    } else {
      control('setSubState', { subState: page.kind === 'content' ? `page:${page.id}` : page.refKey ?? null });
    }
  }

  async function insertAfter(afterId: string | null) {
    if (busyLocal) return;
    setBusyLocal(true);
    try {
      await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, afterId, title: '新页面' }),
      });
      await load();
    } finally {
      setBusyLocal(false);
    }
  }

  async function toggleHidden(p: PageDef) {
    const nextHidden = !p.hidden;
    await fetch('/api/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, hidden: nextHidden }),
    });
    // 隐藏当前正在展示的页时，大屏自动切到相邻可见页（避免大屏停在已隐藏页）
    if (nextHidden && isActive(p)) {
      const visiblePages = pages.filter((x) => x.id !== p.id && !x.hidden);
      const idx = pages.findIndex((x) => x.id === p.id);
      // 优先选前一个可见页，没有则选后一个
      const before = [...pages].reverse().find((x) => x.seq < p.seq && x.id !== p.id && !x.hidden);
      const after = pages.find((x) => x.seq > p.seq && x.id !== p.id && !x.hidden);
      const target = before ?? after ?? visiblePages[0];
      if (target) go(target);
    }
    await load();
  }

  async function move(p: PageDef, dir: -1 | 1) {
    const idx = pages.findIndex((x) => x.id === p.id);
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    const ids = pages.map((x) => x.id);
    const t = ids[idx]; ids[idx] = ids[j]; ids[j] = t;
    await fetch('/api/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group, order: ids }),
    });
    await load();
  }

  async function saveEdit() {
    if (!editingId) return;
    await fetch('/api/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, title: editTitle }),
    });
    setEditingId(null);
    await load();
  }

  async function remove(p: PageDef) {
    if (!window.confirm(`确定删除「${pageLabel(p)}」这一页吗？`)) return;
    await fetch(`/api/pages?id=${p.id}`, { method: 'DELETE' });
    await load();
  }

  const visible = pages.filter((p) => !p.hidden);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
          页面序列（{pages.length} 页 · 点页即投大屏）
        </span>
        <button className="secondary" style={{ fontSize: 11, padding: '3px 10px' }} disabled={busyLocal} onClick={() => insertAfter(null)}>
          ＋ 末尾加页
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
        {pages.map((p) => {
          const active = isActive(p);
          const hidden = p.hidden;
          // A1 的环节页（avatar:*）大屏只有文字，按"内容页"对待：可加图/视频/链接 + 可改默认文字
          const isContent = p.kind === 'content' || (group === 'A1' && !!p.refKey && p.refKey.startsWith('avatar:'));
          const canDelete = p.kind === 'content';
          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* 插入点（每页上方） */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="secondary" style={{ fontSize: 10, padding: '1px 10px', opacity: 0.7 }} disabled={busyLocal} onClick={() => insertAfter(p.id)}>
                  ＋ 在此页前插入新页
                </button>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8,
                border: active ? '2px solid var(--purple)' : '1px solid var(--border)',
                background: active ? 'rgba(124,58,237,0.18)' : 'var(--card)',
                opacity: hidden ? 0.45 : 1,
                cursor: 'pointer',
              }} onClick={() => go(p)}>
                <span style={{ fontSize: 12, fontWeight: 800, color: active ? '#c4b5fd' : 'var(--muted)', minWidth: 22, textAlign: 'center' }}>
                  {p.seq + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pageLabel(p)}
                </span>
                <span style={{ fontSize: 10, color: isContent ? 'var(--blue)' : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 5px' }}>
                  {isContent ? '内容页' : '功能页'}
                </span>
                {hidden && <span style={{ fontSize: 10, color: '#f87171' }}>已隐藏</span>}

                {/* 操作按钮（阻止冒泡） */}
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 3 }}>
                  <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} disabled={busyLocal} title="上移" onClick={() => move(p, -1)}>↑</button>
                  <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} disabled={busyLocal} title="下移" onClick={() => move(p, 1)}>↓</button>
                  {isContent && (
                    <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} title="编辑内容" onClick={() => onEditContent(p.id)}>✎ 内容</button>
                  )}
                  {p.kind === 'builtin' && (
                    <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} title="改默认文字" onClick={() => onEditText(p)}>✎ 改文字</button>
                  )}
                  {p.kind === 'content' && (
                    <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} title="改标题" onClick={() => { setEditingId(p.id); setEditTitle(p.title || ''); }}>改标题</button>
                  )}
                  <button className="secondary" style={{ fontSize: 10, padding: '1px 6px' }} title={hidden ? '显示' : '隐藏'} onClick={() => toggleHidden(p)}>{hidden ? '显示' : '隐藏'}</button>
                  {canDelete && (
                    <button className="danger" style={{ fontSize: 10, padding: '1px 6px' }} title="删除" onClick={() => remove(p)}>删除</button>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        {pages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>还没有页面，点上方「末尾加页」开始。</div>
        )}
      </div>

      {editingId && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="页面标题" style={{ flex: 1 }} />
          <button className="primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={saveEdit}>保存</button>
          <button className="secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setEditingId(null)}>取消</button>
        </div>
      )}
    </div>
  );
}
