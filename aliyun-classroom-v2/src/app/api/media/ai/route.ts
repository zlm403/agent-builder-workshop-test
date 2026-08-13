import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';
import { slotLabel } from '@/lib/slots';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? '').trim();
    const slot = String(body.slot ?? 'a1_cog_after');
    if (!prompt) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '请输入描述' } }, { status: 400 });
    }
    const slotName = slotLabel(slot);

    const sys =
      '你是课堂内容框架助手。根据老师的指令，为课堂内容块生成一段内容。\n' +
      '目标插入位置：' + slotName + '。\n' +
      '内容块类型只能是：text（纯文字）/ image（图片，需给URL）/ video（视频，需给URL）/ link（链接，需给URL）。\n' +
      '除非老师明确给了图片/视频/链接地址，否则一律生成 text 类型。\n' +
      '只输出严格 JSON，格式：{"title":"简短标题","kind":"text","content":"正文内容"} 或 {"title":"...","kind":"image|video|link","url":"地址"}。\n' +
      '文字内容要口语化、有温度，适合大屏展示，100字以内。';

    const raw = await chatWithLLM([{ role: 'user', content: prompt }], sys, { temperature: 0.7, maxTokens: 400, json: true });
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 尝试提取 JSON 片段
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: { code: 'PARSE', message: 'AI 返回无法解析' } }, { status: 500 });
    }
    const kind = ['text', 'image', 'video', 'link'].includes(parsed.kind) ? parsed.kind : 'text';
    const result: any = { title: String(parsed.title ?? '').slice(0, 40), kind };
    if (kind === 'text') result.content = String(parsed.content ?? '').slice(0, 500);
    else result.url = String(parsed.url ?? '');
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
