import { NextRequest, NextResponse } from 'next/server';
import { startClassroom, advanceClassroom, jumpClassroom, setLock, resetClassroom, endClassroom, setModuleSubState } from '@/lib/classroom';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    let result;
    switch (action) {
      case 'start':
        result = await startClassroom(params.id);
        break;
      case 'advance':
        result = await advanceClassroom(params.id);
        break;
      case 'jump':
        if (typeof body.targetModuleId !== 'string') {
          return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'targetModuleId required' } }, { status: 400 });
        }
        result = await jumpClassroom(params.id, body.targetModuleId);
        break;
      case 'lock':
        result = await setLock(params.id, body.locked === true);
        break;
      case 'setSubState':
        if (typeof body.subState !== 'string') {
          return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'subState required' } }, { status: 400 });
        }
        result = await setModuleSubState(params.id, body.subState);
        break;
      case 'reset':
        result = await resetClassroom(params.id);
        break;
      case 'close':
        result = await endClassroom(params.id);
        break;
      default:
        return NextResponse.json({ error: { code: 'UNKNOWN_ACTION', message: action } }, { status: 400 });
    }
    return NextResponse.json({ currentModuleId: result.currentModuleId, moduleLocked: result.moduleLocked, status: result.status });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CONTROL_FAILED', message: String(err) } }, { status: 400 });
  }
}
