import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig, setLLMConfig, maskKey } from '@/lib/serverEnv';

export async function GET() {
  const config = getLLMConfig();
  return NextResponse.json({
    configured: !!config.apiKey,
    maskedKey: maskKey(config.apiKey),
    baseUrl: config.baseUrl,
    model: config.model,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey === undefined ? undefined : String(body.apiKey).trim();
    const baseUrl = body.baseUrl ? String(body.baseUrl).trim() : undefined;
    const model = body.model ? String(body.model).trim() : undefined;

    if (apiKey === undefined) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    setLLMConfig({
      apiKey: apiKey === '' ? '' : apiKey || undefined,
      baseUrl,
      model,
    });

    const config = getLLMConfig();
    return NextResponse.json({
      ok: true,
      configured: !!config.apiKey,
      maskedKey: maskKey(config.apiKey),
      baseUrl: config.baseUrl,
      model: config.model,
    });
  } catch (err) {
    return NextResponse.json(
      { error: '保存失败', message: String(err) },
      { status: 500 }
    );
  }
}
