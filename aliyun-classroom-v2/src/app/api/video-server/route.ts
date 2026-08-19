import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 教室笔记本视频服务基址（运行时配置，无需重新构建）
// 文件 data/video-server.txt：一行 = 笔记本视频服务基址，如 http://192.168.1.20:9123；空/无文件 = 未配置
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'video-server.txt');

async function readBase(): Promise<string | null> {
  try {
    const text = await fs.readFile(FILE, 'utf8');
    const base = text.trim();
    return base || null;
  } catch {
    return null; // 文件不存在/读失败一律视为未配置，绝不让基础链路抛错
  }
}

function normalizeBase(raw: string): string {
  let base = raw.trim();
  // 去掉末尾多余的 / 与 /videos 后缀（教师可能直接粘贴 /videos/xxx 形式的地址）
  while (base.endsWith('/')) base = base.slice(0, -1);
  if (base.toLowerCase().endsWith('/videos')) {
    base = base.slice(0, -'/videos'.length);
    while (base.endsWith('/')) base = base.slice(0, -1);
  }
  return base;
}

export async function GET() {
  const base = await readBase();
  return NextResponse.json({ base });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = String(body.base ?? '').trim();
    if (!raw) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '视频服务器地址不能为空' } }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(raw)) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '地址需以 http:// 或 https:// 开头' } }, { status: 400 });
    }
    const base = normalizeBase(raw);
    if (!/^https?:\/\//i.test(base)) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: '地址格式不正确' } }, { status: 400 });
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, base, 'utf8');
    return NextResponse.json({ ok: true, base });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}