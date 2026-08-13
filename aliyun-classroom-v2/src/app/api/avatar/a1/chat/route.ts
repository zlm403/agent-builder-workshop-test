import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1, withA1Lock } from '@/features/avatarLesson/store';
import { a1StageReply, a1BuildReply, generateAvatar } from '@/features/avatarLesson/ai';
import type { A1ChatTurn } from '@/features/avatarLesson/store';
import { A1_STAGES } from '@/features/avatarLesson/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stage?: string; // c1..c17
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const stage = body.stage || 'c1';
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const result = await withA1Lock(sessionId, async () => {
      const rec = await ensureA1Record(sessionId, anonymousId);
      const chatLog: A1ChatTurn[] = (rec.chatLog as A1ChatTurn[] | null) ?? [];

      let reply = '';
      let done = false;
      let makeProfile = false; // c4 采访完成 → 生成档案

      if (stage === 'c4') {
        const b = await a1BuildReply(chatLog, message);
        reply = b.reply || '';
        done = b.done;
        if (b.done) {
          makeProfile = true;
          const fullLog: A1ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];
          const g = await generateAvatar(fullLog);
          await updateA1(sessionId, anonymousId, { profileJson: g.profile as object, skillText: g.skill });
        }
      } else {
        const idx = A1_STAGES.findIndex((s) => s.key === stage);
        const hintText = A1_STAGES[Math.max(0, idx)]?.studentTask ?? '';
        reply = await a1StageReply(stage, chatLog, hintText);
      }

      const newLog: A1ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

      // 环节推进：由教师控制 subState（avatar:c1..c17），这里只记录当前环节和产出
      const stageIdx = A1_STAGES.findIndex((s) => s.key === stage);
      const dbStep = Math.min(17, Math.max(1, stageIdx + 1));

      const patch: any = { chatLog: newLog as object, step: dbStep };

      // 记录关键字段
      if (stage === 'c2') patch.dream = message; // 分身名字
      if (stage === 'c3') patch.task = message; // 朋友圈任务
      if (stage === 'c4' && !done) patch.profileJson = rec.profileJson; // 采访中
      if (stage === 'c6') patch.skillText = rec.skillText; // 档案（profile 已存）
      if (stage === 'c8' || stage === 'c10') patch.drafts = rec.drafts; // 草稿
      if (stage === 'c11' || stage === 'c12') {
        patch.finalText = message;
        patch.submittedAt = new Date();
      }

      await updateA1(sessionId, anonymousId, patch);

      publish(sessionId, { type: 'analytics:update', payload: {} });
      return { reply, done, makeProfile, stage, step: dbStep };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
