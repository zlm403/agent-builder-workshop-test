import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '未收到文件' } }, { status: 400 });
    }
    // 仅允许视频/图片
    const type = file.type;
    if (!type.startsWith('video/') && !type.startsWith('image/')) {
      return NextResponse.json({ error: { code: 'BAD_TYPE', message: '仅支持视频/图片文件' } }, { status: 400 });
    }
    const ext = path.extname(file.name) || (type.startsWith('video/') ? '.mp4' : '.png');
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dir = path.join(process.cwd(), 'public', 'media');
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, safeName), buf);
    // 走动态文件路由：next start 不会实时服务运行时新增的 public 静态文件，
    // 用 /api/media/file/<name> 可实时读取，上传后无需重启即可在大屏显示。
    const url = `/api/media/file/${safeName}`;
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
