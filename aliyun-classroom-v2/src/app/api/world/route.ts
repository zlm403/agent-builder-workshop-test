export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readControl, readLives, readState, writeState } from '@/lib/world/store';
import { advance, createInitialState, DEFAULT_CONFIG, makeRng, type WorldState } from '@/lib/world/engine';

// 惰性推进：读取时按墙钟差补算 tick，再返回裁剪后的状态。
// 角色裁剪：
//   ?sessionId=&view=screen  大屏公共视图（所有生命的公开字段 + 资源 + 事件）
//   ?sessionId=&anonymousId= 学生本人视图（自己的完整倾向/关系 + 其他生命公开字段）
//   ?sessionId=&view=teacher 教师全量视图

function publicLife(l: WorldState['lives'][number]) {
  return {
    id: l.id,
    name: l.name,
    color: l.color,
    x: l.x,
    y: l.y,
    energy: l.energy,
    state: l.state,
    action: l.action,
    reason: l.reason,
    activeVersion: l.activeVersion,
    importantRelations: Object.entries(l.relations)
      .filter(([, v]) => v >= 40)
      .map(([id, v]) => ({ lifeId: id, value: v })),
  };
}

function selfLife(l: WorldState['lives'][number]) {
  return {
    ...publicLife(l),
    social: l.social,
    helpful: l.helpful,
    cautious: l.cautious,
    relations: l.relations,
  };
}

export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view') ?? 'screen';
  const anonymousId = req.nextUrl.searchParams.get('anonymousId');

  const control = readControl();
  const livesData = readLives();
  let state = readState();

  if (!state) {
    // 首次：按当前 control 初始化世界
    state = createInitialState(livesData.lives, control, DEFAULT_CONFIG, makeRng(DEFAULT_CONFIG.seed));
    writeState(state);
  } else {
    // 惰性推进（running 时按墙钟差补算）
    const r = advance(state, DEFAULT_CONFIG, Date.now());
    state = r.state;
    if (r.advancedSeconds > 0) writeState(state);
  }

  const lives = (state.lives ?? []).map((l) => (anonymousId && l.id === `life-${anonymousId}` ? selfLife(l) : publicLife(l)));

  return NextResponse.json({
    status: control.status,
    round: control.round,
    updatedAt: state.updatedAt,
    simulationTime: state.simulationTime,
    lives,
    resources: state.resources,
    keyEvents: state.keyEvents,
    relationshipFeedbackEnabled: DEFAULT_CONFIG.relationshipFeedbackEnabled,
    myLife: anonymousId
      ? (() => {
          const m = state.lives.find((l) => l.id === `life-${anonymousId}`);
          return m ? selfLife(m) : null;
        })()
      : undefined,
  });
}
