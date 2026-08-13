import { NextRequest, NextResponse } from 'next/server';
import { getP3Record, saveLifeDesign, markP3Submitted } from '@/features/growGame/store';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = String(req.nextUrl.searchParams.get('sessionId') ?? '');
    const anonymousId = String(req.nextUrl.searchParams.get('anonymousId') ?? '');
    if (!sessionId || !anonymousId) return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });
    const rec = await getP3Record(sessionId, anonymousId);
    return NextResponse.json({
      objectName: rec?.objectName ?? '',
      trait: rec?.trait ?? '',
      traitWhy: rec?.traitWhy ?? '',
      lifeDesign: rec?.lifeDesign ?? null,
      finalWork: rec?.finalWork ?? '',
      submittedAt: rec?.submittedAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const mode = String(body.mode ?? 'save'); // save | launch | note
    if (!anonymousId || !sessionId) return NextResponse.json({ error: { code: 'MISSING_ID' } }, { status: 400 });

    if (mode === 'save') {
      // 保存生命设计
      const objectName = String(body.objectName ?? '').trim();
      const trait = String(body.trait ?? '').trim();
      const traitWhy = String(body.traitWhy ?? '').trim();
      const lifeDesign = body.lifeDesign ?? {};
      if (!objectName || !trait || !lifeDesign) {
        return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '名字/特质/设计必填' } }, { status: 400 });
      }
      await saveLifeDesign(sessionId, anonymousId, { objectName, trait, traitWhy, lifeDesign });
      return NextResponse.json({ ok: true });
    }

    if (mode === 'launch') {
      // 投入共生缸
      const finalWork = String(body.finalWork ?? '');
      await markP3Submitted(sessionId, anonymousId, finalWork);
      publish(sessionId, { type: 'analytics:update', payload: {} });
      return NextResponse.json({ ok: true });
    }

    if (mode === 'note') {
      // 保存观察/修改记录
      const rec = await getP3Record(sessionId, anonymousId);
      const prev = (rec?.lifeNotes as any) ?? {};
      await saveLifeDesign(sessionId, anonymousId, {
        objectName: rec?.objectName ?? '',
        trait: rec?.trait ?? '',
        traitWhy: rec?.traitWhy ?? '',
        lifeDesign: (rec?.lifeDesign as any) ?? {},
      }).then(async () => {
        // 用 updateP3 写 lifeNotes
        const { updateP3 } = await import('@/features/growGame/store');
        await updateP3(sessionId, anonymousId, { lifeNotes: { ...prev, ...(body.note ?? {}) } });
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
