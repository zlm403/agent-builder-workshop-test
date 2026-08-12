import { NextRequest, NextResponse } from 'next/server';
import { ensureP2Record, updateP2 } from '@/features/siteEntry/store';
import { p2ChatReply, p2SkeletonReply } from '@/features/siteEntry/ai';
import type { P2ChatTurn } from '@/features/siteEntry/store';
import { P2_STEPS } from '@/features/siteEntry/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const STEP_ORDER = ['field', 'entry', 'skeleton', 'judge', 'design', 'iterate'];

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stepKey?: string;
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
    const stepKey = body.stepKey || 'field';
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const rec = await ensureP2Record(sessionId, anonymousId);
    const chatLog: P2ChatTurn[] = (rec.chatLog as P2ChatTurn[] | null) ?? [];

    let reply = '';
    let done = false;

    if (stepKey === 'skeleton') {
      const b = await p2SkeletonReply(chatLog, message);
      reply = b.reply || '';
      done = b.done;
    } else {
      const idx = STEP_ORDER.indexOf(stepKey);
      const hintText = P2_STEPS[Math.max(0, idx)]?.title ?? '';
      reply = await p2ChatReply(stepKey, chatLog, hintText);
    }

    const newLog: P2ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

    const stepIdx = STEP_ORDER.indexOf(stepKey);
    const isAdvance = /进入下一步|我准备好了/.test(message);
    let dbStep: number;
    if (isAdvance) dbStep = Math.min(6, stepIdx + 2);
    else if (stepKey === 'skeleton' && done) dbStep = Math.min(6, stepIdx + 2);
    else dbStep = Math.min(6, Math.max(1, stepIdx + 1));

    const patch: any = { chatLog: newLog as object };
    if (stepKey === 'field' && !isAdvance) patch.field = message;
    if (stepKey === 'entry' && !isAdvance) patch.entryTask = message;
    if (stepKey === 'skeleton' && !isAdvance) patch.skeleton = message;
    if (stepKey === 'judge' && !isAdvance) patch.keyDiff = message;
    if (stepKey === 'design' && !isAdvance) patch.sitePlan = message;
    patch.step = dbStep;

    await updateP2(sessionId, anonymousId, patch);
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ reply, done, stepKey, step: dbStep });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}