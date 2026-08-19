export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { startClassroom, advanceClassroom, jumpClassroom, setLock, resetClassroom, endClassroom, setModuleSubState, resetModuleProgress, invalidateSessionCache, broadcastPlayVideo } from '@/lib/classroom';

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
        // jump 后立即设置子屏（A0 章节跨模块跳转时指定 reveal:N）
        if (typeof body.subState === 'string' && body.subState) {
          await setModuleSubState(params.id, body.subState);
        }
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
      case 'playVideo': {
        const action = (body.cmd as string) || (body.action as string) || 'play';
        if (action === 'play' && (typeof body.url !== 'string' || !body.url)) {
          return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'url required for play' } }, { status: 400 });
        }
        result = await broadcastPlayVideo(params.id, { action: action as 'play' | 'pause' | 'stop', url: typeof body.url === 'string' ? body.url : undefined });
        break;
      }
      case 'resetModule':
        if (typeof body.moduleId !== 'string') {
          return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'moduleId required' } }, { status: 400 });
        }
        result = await resetModuleProgress(params.id, body.moduleId);
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
    // 控制操作后清除缓存，确保下次拉取最新状态
    invalidateSessionCache(params.id);
    return NextResponse.json({ currentModuleId: result.currentModuleId, moduleLocked: result.moduleLocked, status: result.status });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CONTROL_FAILED', message: String(err) } }, { status: 400 });
  }
}
