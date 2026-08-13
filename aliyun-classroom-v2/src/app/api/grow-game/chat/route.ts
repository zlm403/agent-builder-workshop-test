import { NextRequest, NextResponse } from 'next/server';
import { ensureP3Record, updateP3 } from '@/features/growGame/store';
import { p3StageReply } from '@/features/growGame/ai';
import type { P3ChatTurn } from '@/features/growGame/store';
import { P3_STAGES } from '@/features/growGame/config';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

// 十阶段（数字生命共生缸）：s1..s10
const STAGE_ORDER = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stage?: string;
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
    const stage = body.stage || 's1';
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const rec = await ensureP3Record(sessionId, anonymousId);
    const chatLog: P3ChatTurn[] = (rec.chatLog as P3ChatTurn[] | null) ?? [];

    const idx = STAGE_ORDER.indexOf(stage);
    const hintText = P3_STAGES[Math.max(0, idx)]?.studentTask ?? '';
    const reply = await p3StageReply(stage, chatLog, hintText);

    const newLog: P3ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

    const dbStep = Math.min(10, Math.max(1, idx + 1));

    const patch: any = { chatLog: newLog as object, step: dbStep };
    if (stage === 's2') patch.trait = message;
    patch.step = dbStep;

    await updateP3(sessionId, anonymousId, patch);
    publish(sessionId, { type: 'analytics:update', payload: {} });
    return NextResponse.json({ reply, stage, step: dbStep });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
