'use client';
// =========================================================
// A0 新版 + A1 数字分身 · 教师端控制面板
// 单纯的按钮/说明插件，交给 TeacherPage 的 control() 执行。
// =========================================================
import { A1_STEPS } from '@/features/avatarLesson/config';

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
  // A0 揭晓屏控制
  if (moduleId === 'A0N_REVEAL') {
    const screen = subState ?? 'reveal:1';
    const screens = [
      { key: 'reveal:1', label: '1. 揭晓结果' },
      { key: 'reveal:2', label: '2. 过去 vs 未来' },
      { key: 'reveal:3', label: '3. 两张艺术图' },
    ];
    return (
      <div className="story-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {screens.map((s) => (
          <button
            key={s.key}
            className="secondary"
            disabled={busy || screen === s.key}
            onClick={() => control('setSubState', { subState: s.key })}
          >
            {s.label}
          </button>
        ))}
        <span className="story-hint">A0 · 揭晓讲解三屏，逐屏引导</span>
      </div>
    );
  }

  // A1 数字分身 · 六格点亮 + 朋友圈墙
  if (moduleId === 'A1_AVATAR') {
    const current = (() => {
      const m = String(subState ?? '').match(/^avatar:(\d+)$/);
      return m ? Math.min(6, Math.max(1, parseInt(m[1], 10))) : 1;
    })();
    const isWall = subState === 'avatar:wall';
    return (
      <div className="story-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="secondary"
          disabled={busy || current <= 1}
          onClick={() => control('setSubState', { subState: `avatar:${Math.max(1, current - 1)}` })}
        >
          ◀ 上一格
        </button>
        <span className="story-hint" style={{ minWidth: 120 }}>
          正在第 {isWall ? '作品墙' : current} 格 · {isWall ? '' : A1_STEPS[current - 1]?.name}
        </span>
        {!isWall && current < 6 ? (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => control('setSubState', { subState: `avatar:${Math.min(6, current + 1)}` })}
          >
            点亮下一步 ▶
          </button>
        ) : null}
        <button
          className="primary"
          disabled={busy || isWall}
          onClick={() => control('setSubState', { subState: 'avatar:wall' })}
        >
          {isWall ? '作品墙已开（再次进入）' : '展示作品墙'}
        </button>
        <span className="story-hint">A1 · 手机端连续对话，大屏六格逐一点亮，最后展示全班朋友圈墙</span>
      </div>
    );
  }

  // 其它 A0 模块：通用提示
  if (moduleId === 'A0N_QUESTIONS') {
    return <span className="story-hint">A0-1 · 学生回答三问，答得差不多点「下一环节」进入投票。</span>;
  }
  if (moduleId === 'A0N_VOTE') {
    return <span className="story-hint">A0-2 · 学生做唯一的关系题投票，收齐后点「下一环节」进入揭晓。</span>;
  }
  return null;
}
