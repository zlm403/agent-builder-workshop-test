import { NextRequest, NextResponse } from 'next/server';
import { ensureP2Record, updateP2 } from '@/features/siteEntry/store';
import { p2StageReply, p2SkeletonReply } from '@/features/siteEntry/ai';
import type { P2ChatTurn } from '@/features/siteEntry/store';
import { P2_STAGES } from '@/features/siteEntry/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

// 十二阶段（六座山）：s1 发布任务 → s2 明确目标 → s3 领域地图 → s4 判断收缩
// → s5 生成内容 → s6 生成网页 → s7 自检 → s8 同伴测试 → s9 反馈修改 → s10 迁移 → s11 提交 → s12 升华
const STAGE_ORDER = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stage?: string; // s1..s12
  message?: string;
  picked?: string[]; // s4 勾选的问题
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const stage = body.stage || 's1';
    const message = String(body.message ?? '').trim();
    if (!message && !body.picked) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const rec = await ensureP2Record(sessionId, anonymousId);
    const chatLog: P2ChatTurn[] = (rec.chatLog as P2ChatTurn[] | null) ?? [];

    let reply = '';
    if (body.picked) {
      // s4：勾选 3 个核心问题
      reply = '好的，你的 3 个核心问题已经选好了：\n' + (body.picked as string[]).map((p) => '· ' + p).join('\n') + '\n\n接下来我们把它写成新手看得懂的内容。';
    } else {
      const idx = STAGE_ORDER.indexOf(stage);
      const hintText = P2_STAGES[Math.max(0, idx)]?.studentTask ?? '';
      reply = await p2StageReply(stage, chatLog, hintText);
    }

    const newLog: P2ChatTurn[] = [...chatLog, { role: 'user', content: message || `【勾选】${(body.picked ?? []).join('；')}` }, { role: 'ai', content: reply }];

    // 阶段推进：由教师控制 subState，这里只存对话和该阶段产出
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const dbStep = Math.min(12, Math.max(1, stageIdx + 1));

    const patch: any = { chatLog: newLog as object, step: dbStep };
    if (stage === 's1') patch.field = message;
    if (stage === 's2') patch.goalTask = message;
    if (stage === 's3') patch.knowledgeQs = message;
    if (stage === 's4' && body.picked) patch.knowledgeQs = (body.picked as string[]).join('\n');
    if (stage === 's5') patch.contentBlocks = message;

    await updateP2(sessionId, anonymousId, patch);
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ reply, stage, step: dbStep });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
