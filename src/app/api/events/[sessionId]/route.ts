import { NextResponse } from 'next/server';
import { subscribe, RealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* 客户端已断开时忽略 */
        }
      };

      const unsubscribe = subscribe(sessionId, send);

      // 发送一条连接成功的心跳，帮助客户端确认通道可用
      send({ type: 'connected', payload: { sessionId } });

      // 60 秒一次心跳，防止超时/断连
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      _request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
