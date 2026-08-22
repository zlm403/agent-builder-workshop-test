import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const name = String(params.name ?? '');
    // 防止路径穿越：只允许文件名（不含路径分隔符）
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '非法文件名' } }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'public', 'media', name);
    const buf = await readFile(filePath);
    const ext = path.extname(name).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: '文件不存在' } }, { status: 404 });
  }
}
