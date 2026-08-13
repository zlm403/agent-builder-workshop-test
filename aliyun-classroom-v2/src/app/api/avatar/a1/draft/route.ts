import { NextRequest, NextResponse } from 'next/server';
import { ensureA1Record, updateA1 } from '@/features/avatarLesson/store';
import { generateDrafts, judgeDraft } from '@/features/avatarLesson/ai';
import type { A1ChatTurn } from '@/features/avatarLesson/store';

export const dynamic = 'force-dynamic';

interface DraftItem {
  id: string;
  text: string;
  picked?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    if (!anonymousId || !sessionId) {
      return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    }
    const mode = String(body.mode ?? 'generate'); // generate | judge
    const rec = await ensureA1Record(sessionId, anonymousId);
    const profile = (rec.profileJson as any) ?? {};
    const plan = String(rec.planChoice ?? 'life');
    const task = String(rec.task ?? '');
    const skillText = String(rec.skillText ?? '');

    if (mode === 'generate') {
      const texts = await generateDrafts(plan, task, profile, skillText);
      const drafts: DraftItem[] = texts.map((t, i) => ({ id: 'd' + (i + 1), text: t }));
      // check 步生成草稿（step 5），提交时才到 iterate(6)
      await updateA1(sessionId, anonymousId, { drafts: drafts as object, step: 5 });
      return NextResponse.json({ drafts });
    }

    // judge：对选中草稿判定是否可发布（只存反馈与暂存文本，不标记提交）
    const finalText = String(body.finalText ?? '');
    if (!finalText) return NextResponse.json({ error: { code: 'EMPTY' } }, { status: 400 });
    const judgment = await judgeDraft(finalText);
    await updateA1(sessionId, anonymousId, {
      feedback: judgment.note,
      finalText,
      step: 5,
    });
    return NextResponse.json(judgment);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
