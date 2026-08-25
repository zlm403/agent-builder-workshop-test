import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1, withA1Lock } from '@/features/avatarLesson/store';
import { a1FreeReply } from '@/features/avatarLesson/ai';
import type { A1ChatTurn } from '@/features/avatarLesson/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

interface Body {
  anonymousId?: string;
  sessionId?: string;
  stage?: string; // 已解耦：学生端统一传 'free'，不再按 subState 绑定环节
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
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: { code: 'EMPTY_MSG' } }, { status: 400 });

    const result = await withA1Lock(sessionId, async () => {
      const rec = await ensureA1Record(sessionId, anonymousId);
      const chatLog: A1ChatTurn[] = (rec.chatLog as A1ChatTurn[] | null) ?? [];

      // 若已生成分身 Skill，把 Skill 注入上下文，让 AI 用它替学生写朋友圈
      const hintText = rec.skillText
        ? '学生已生成的分身 Skill（务必严格按它写，用学生的语气）：\n' + rec.skillText
        : '';

      const r = await a1FreeReply(chatLog, hintText);
      const reply = r.reply;
      const offerGenerate = r.offerGenerate;

      const newLog: A1ChatTurn[] = [...chatLog, { role: 'user', content: message }, { role: 'ai', content: reply }];

      // 环节推进由教师端 subState 控制，这里只记录对话与轮数；Skill/提交由各自接口落库
      await updateA1(sessionId, anonymousId, { chatLog: newLog as object, step: newLog.length } as any);

      publish(sessionId, { type: 'analytics:update', payload: {} });
      return { reply, offerGenerate, stage: 'free', step: newLog.length };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
