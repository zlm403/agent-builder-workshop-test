export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { setPopup, POPUP_CONTENTS, type PopupContent } from '@/lib/world/store';

// 教师控制大屏弹窗：{ content: 'usage' | 'method' | 'tip01'..'tip08' | null, show: boolean }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const content = body.content as PopupContent | null;
  const show = body.show === true;
  if (content !== null && !POPUP_CONTENTS.includes(content)) {
    return NextResponse.json({ error: { code: 'BAD_CONTENT', message: String(content) } }, { status: 400 });
  }
  const popup = setPopup(content, show);
  return NextResponse.json({ popup });
}
