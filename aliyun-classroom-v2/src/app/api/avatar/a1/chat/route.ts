import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1, withA1Lock } from '@/features/avatarLesson/store';
import { a1ChatReply, a1BuildReply, generateAvatar } from '@/features/avatarLesson/ai';
import type { A1ChatTurn } from '@/features/avatarLesson/store';
import { A1_STEPS } from '@/features/avatarLesson/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stepKey?: string; // dream | path | build | task | plan | iterate
  message?: string;
  planKey?: string; // 方案 key（plan 步选择时传入，如 life/attitude/contrast）
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const stepKey = body.stepKey || 'dream';
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const result = await withA1Lock(sessionId, async () => {
      const rec = await ensureA1Record(sessionId, anonymousId);
      const chatLog: A1ChatTurn[] = (rec.chatLog as A1ChatTurn[] | null) ?? [];

      let reply = '';
      let advanceKey: string | null = null;
      let done = false;

      if (stepKey === 'build') {
        const b = await a1BuildReply(chatLog, message);
        reply = b.reply || '';
        done = b.done;
        if (b.done) {
          advanceKey = 'task';
          // 生成数字分身画像 + Skill
          const fullLog: A1ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];
          const g = await generateAvatar(fullLog);
          await updateA1(sessionId, anonymousId, { profileJson: g.profile as object, skillText: g.skill });
        }
      } else {
        const nextIdx = A1_STEPS.findIndex((s) => s.key === stepKey);
        const idx = nextIdx === -1 ? 0 : nextIdx;
        const hintText = A1_STEPS[idx]?.title ?? '';
        reply = await a1ChatReply(stepKey, chatLog, hintText);
      }

      // 追加本轮对话
      const newLog: A1ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

      // step 语义：学生当前所在的步骤（1..6，对应 A1_STEPS 的 1-based 下标）。
      // 普通对话 = 当前步；「进入下一步」= 推进到下一步；build 完成 = 推进到 task(4)。
      const stepIdx = A1_STEPS.findIndex((s) => s.key === stepKey);
      const isAdvance = /进入下一步|我准备好了/.test(message);
      let dbStep: number;
      if (isAdvance) dbStep = Math.min(6, stepIdx + 2);
      else if (advanceKey === 'task') dbStep = 4;
      else dbStep = Math.min(6, Math.max(1, stepIdx + 1));

      const patch: any = { chatLog: newLog as object };

      // 记录关键字段（“进入下一步”占位消息不覆盖真实内容）
      if (stepKey === 'dream' && !isAdvance) patch.dream = message;
      if (stepKey === 'path' && !isAdvance) patch.path = message;
      if (stepKey === 'task' && !isAdvance) patch.task = message;
      if (stepKey === 'plan') patch.planChoice = String(body.planKey || message);

      if (stepKey === 'iterate' && done) {
        // iterate 步：提交最终作品
        patch.finalText = message;
        patch.submittedAt = new Date();
        patch.step = 6;
      } else {
        patch.step = dbStep;
      }
      await updateA1(sessionId, anonymousId, patch);

      publish(sessionId, { type: 'analytics:update', payload: {} });
      return { reply, advanceKey, done, stepKey, step: patch.step };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
