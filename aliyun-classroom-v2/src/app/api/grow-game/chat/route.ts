import { NextRequest, NextResponse } from 'next/server';
import { ensureP3Record, updateP3 } from '@/features/growGame/store';
import { p3ChatReply, p3RulesReply } from '@/features/growGame/ai';
import type { P3ChatTurn } from '@/features/growGame/store';
import { P3_STEPS } from '@/features/growGame/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const STEP_ORDER = ['object', 'growth', 'rules', 'events', 'endings', 'iterate'];

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
    const stepKey = body.stepKey || 'object';
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const rec = await ensureP3Record(sessionId, anonymousId);
    const chatLog: P3ChatTurn[] = (rec.chatLog as P3ChatTurn[] | null) ?? [];

    let reply = '';
    let done = false;

    if (stepKey === 'rules') {
      const b = await p3RulesReply(chatLog, message);
      reply = b.reply || '';
      done = b.done;
    } else {
      const idx = STEP_ORDER.indexOf(stepKey);
      const hintText = P3_STEPS[Math.max(0, idx)]?.title ?? '';
      reply = await p3ChatReply(stepKey, chatLog, hintText);
    }

    const newLog: P3ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

    const stepIdx = STEP_ORDER.indexOf(stepKey);
    const isAdvance = /进入下一步|我准备好了/.test(message);
    let dbStep: number;
    if (isAdvance) dbStep = Math.min(6, stepIdx + 2);
    else if (stepKey === 'rules' && done) dbStep = Math.min(6, stepIdx + 2);
    else dbStep = Math.min(6, Math.max(1, stepIdx + 1));

    const patch: any = { chatLog: newLog as object };
    if (stepKey === 'object' && !isAdvance) patch.objectName = message;
    if (stepKey === 'growth' && !isAdvance) patch.growthDef = message;
    if (stepKey === 'rules' && !isAdvance) patch.coreRules = message;
    if (stepKey === 'events' && !isAdvance) patch.events = message;
    if (stepKey === 'endings' && !isAdvance) patch.endings = message;
    patch.step = dbStep;

    await updateP3(sessionId, anonymousId, patch);
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ reply, done, stepKey, step: dbStep });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}