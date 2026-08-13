'use client';
// =========================================================
// A0 + A1 数字分身 + P2 快速入门网站 + P3 养成游戏 · 教师端环节控制面板
// 环节内的分步骤统一用带序号按钮控制（点谁高亮），附 上一步/下一步
// 锁定学员输入放在环节操作区
// =========================================================
import { A1_STAGES } from '@/features/avatarLesson/config';
import { P2_STAGES } from '@/features/siteEntry/config';
import { P3_STAGES } from '@/features/growGame/config';

// 通用：一组带序号的步骤按钮，点谁谁高亮
function StepButtons({
  steps,
  activeKey,
  disabled,
  onPick,
}: {
  steps: { key: string; label: string }[];
  activeKey: string;
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const active = activeKey === s.key;
        return (
          <button
            key={s.key}
            className={active ? 'primary' : 'secondary'}
            disabled={disabled}
            onClick={() => onPick(s.key)}
            style={{ fontWeight: active ? 800 : 500, border: active ? '2px solid var(--purple)' : '1px solid var(--border)' }}
          >
            {i + 1} · {s.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AvatarTeacher({
  moduleId,
  subState,
  busy,
  control,
}: {
  moduleId: string;
  subState: string | null;
  busy: boolean;
  control: (action: string, payload?: any) => void;
}) {
  const pick = (key: string) => control('setSubState', { subState: key });

  // ---------- A0 章节（开场/三问/判定/揭晓/形态/滑块/图/镜子/收束 一条条） ----------
  if (moduleId === 'A0N_QUESTIONS' || moduleId === 'A0N_VOTE' || moduleId === 'A0N_REVEAL') {
    // A0 流程：开场（手指图→二维图）→ 三问 → 判定 → 揭晓 → 三种形态 → 六步滑块 → 工具/伙伴两图 → 镜子 → 收束
    const steps = [
      { module: 'A0N_QUESTIONS', key: 'a0:intro1', label: '开场·手指图' },
      { module: 'A0N_QUESTIONS', key: 'a0:intro2', label: '开场·发展图' },
      { module: 'A0N_QUESTIONS', key: null, label: '三问' },
      { module: 'A0N_VOTE', key: null, label: '系统判定' },
      { module: 'A0N_REVEAL', key: 'reveal:1', label: '揭晓结果' },
      { module: 'A0N_REVEAL', key: 'reveal:2', label: '三种形态' },
      { module: 'A0N_REVEAL', key: 'reveal:4', label: '六步滑块' },
      { module: 'A0N_REVEAL', key: 'reveal:3', label: '工具/伙伴两图' },
      { module: 'A0N_REVEAL', key: 'a0:mirror', label: '我们在哪儿' },
      { module: 'A0N_REVEAL', key: 'a0:closing', label: '收束·已经来了' },
    ];
    // 当前处于哪一步
    const activeIdx = (() => {
      if (moduleId === 'A0N_QUESTIONS') {
        const s = String(subState ?? '');
        if (s === 'a0:intro1') return 0;
        if (s === 'a0:intro2') return 1;
        return 2; // 三问
      }
      if (moduleId === 'A0N_VOTE') return 3;
      const reveal = String(subState ?? 'reveal:1');
      if (reveal.startsWith('a0:mirror')) return 8;
      if (reveal.startsWith('a0:closing')) return 9;
      if (reveal.startsWith('reveal:1')) return 4;
      if (reveal.startsWith('reveal:2')) return 5;
      if (reveal.startsWith('reveal:4')) return 6;
      if (reveal.startsWith('reveal:3')) return 7;
      return 4;
    })();
    // 跳到某一步：跨模块用 jump（可带 subState 直接落到指定子屏），同模块用 setSubState
    const go = (idx: number) => {
      const s = steps[idx];
      if (!s) return;
      if (s.module === moduleId) {
        if (s.key) control('setSubState', { subState: s.key });
      } else {
        control('jump', { targetModuleId: s.module, subState: s.key });
      }
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StepButtons
          steps={steps.map((s, i) => ({ key: String(i), label: s.label }))}
          activeKey={String(activeIdx)}
          disabled={busy}
          onPick={(k) => go(parseInt(k, 10))}
        />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="secondary" disabled={busy || activeIdx <= 0} onClick={() => go(activeIdx - 1)}>◀ 上一步</button>
          <button className="secondary" disabled={busy || activeIdx >= steps.length - 1} onClick={() => go(activeIdx + 1)}>下一步 →</button>
        </div>
      </div>
    );
  }

  // ---------- A0 揭晓 ----------
  if (moduleId === 'A0N_REVEAL') {
    const steps = [
      { key: 'reveal:1', label: '揭晓结果' },
      { key: 'reveal:2', label: '三种形态' },
      { key: 'reveal:3', label: '艺术图' },
      { key: 'reveal:4', label: '推送滑杆' },
    ];
    const order = ['reveal:1', 'reveal:2', 'reveal:3', 'reveal:4'];
    const activeKey = String(subState ?? 'reveal:1');
    const curIdx = order.indexOf(activeKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StepButtons steps={steps} activeKey={activeKey} disabled={busy} onPick={pick} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="secondary" disabled={busy || curIdx <= 0} onClick={() => control('setSubState', { subState: order[Math.max(0, curIdx - 1)] })}>◀ 上一步</button>
          <button className="secondary" disabled={busy || curIdx >= order.length - 1} onClick={() => control('setSubState', { subState: order[Math.min(order.length - 1, curIdx + 1)] })}>下一步 →</button>
        </div>
      </div>
    );
  }

  // ---------- A1 数字分身 ----------
  if (moduleId === 'A1_AVATAR') {
    const steps = [
      { key: 'avatar:hook', label: '钩子开场' },
      ...A1_STAGES.map((s, i) => ({ key: `avatar:${s.key}`, label: `${i + 1}.${s.name}` })),
      { key: 'avatar:wall', label: '作品墙' },
    ];
    const order = ['avatar:hook', ...A1_STAGES.map((s) => `avatar:${s.key}`), 'avatar:wall'];
    const activeKey = String(subState ?? 'avatar:hook');
    const curIdx = order.indexOf(activeKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StepButtons steps={steps} activeKey={activeKey} disabled={busy} onPick={pick} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="secondary" disabled={busy || curIdx <= 0} onClick={() => control('setSubState', { subState: order[Math.max(0, curIdx - 1)] })}>◀ 上一步</button>
          <button className="secondary" disabled={busy || curIdx >= order.length - 1} onClick={() => control('setSubState', { subState: order[Math.min(order.length - 1, curIdx + 1)] })}>下一步 →</button>
        </div>
      </div>
    );
  }

  // ---------- P2 快速入门网站 · 六座山十二阶段 ----------
  if (moduleId === 'P2_SITE') {
    const steps = [
      { key: 'p2:hook', label: '钩子开场' },
      ...P2_STAGES.map((s, i) => ({ key: `p2:${s.key}`, label: `${i + 1}.${s.name}` })),
      { key: 'p2:wall', label: '作品墙' },
    ];
    const order = ['p2:hook', ...P2_STAGES.map((s) => `p2:${s.key}`), 'p2:wall'];
    const activeKey = String(subState ?? 'p2:hook');
    const curIdx = order.indexOf(activeKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StepButtons steps={steps} activeKey={activeKey} disabled={busy} onPick={pick} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="secondary" disabled={busy || curIdx <= 0} onClick={() => control('setSubState', { subState: order[Math.max(0, curIdx - 1)] })}>◀ 上一步</button>
          <button className="secondary" disabled={busy || curIdx >= order.length - 1} onClick={() => control('setSubState', { subState: order[Math.min(order.length - 1, curIdx + 1)] })}>下一步 →</button>
        </div>
      </div>
    );
  }

  // ---------- P3 养成游戏 ----------
  if (moduleId === 'P3_GAME') {
    const steps = [
      { key: 'p3:hook', label: '钩子开场' },
      ...P3_STAGES.map((s, i) => ({ key: `p3:${s.key}`, label: `${i + 1}.${s.name}` })),
      { key: 'p3:wall', label: '共生缸' },
    ];
    const order = ['p3:hook', ...P3_STAGES.map((s) => `p3:${s.key}`), 'p3:wall'];
    const activeKey = String(subState ?? 'p3:hook');
    const curIdx = order.indexOf(activeKey);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StepButtons steps={steps} activeKey={activeKey} disabled={busy} onPick={pick} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="secondary" disabled={busy || curIdx <= 0} onClick={() => control('setSubState', { subState: order[Math.max(0, curIdx - 1)] })}>◀ 上一步</button>
          <button className="secondary" disabled={busy || curIdx >= order.length - 1} onClick={() => control('setSubState', { subState: order[Math.min(order.length - 1, curIdx + 1)] })}>下一步 →</button>
        </div>
      </div>
    );
  }

  // 其它 A0 模块
  if (moduleId === 'A0N_QUESTIONS') {
    return <span className="story-hint">学生回答三问，答得差不多进入系统判定。</span>;
  }
  if (moduleId === 'A0N_VOTE') {
    return <span className="story-hint">系统后台判定每位学生的关系，大屏实时显示，收齐后进入揭晓。</span>;
  }
  return null;
}
