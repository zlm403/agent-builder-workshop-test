import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { isWechatConfigured, buildWechatAuthUrl } from '@/lib/wechat';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) {
    return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 });
  }
  // 优先使用配置好的对外公开地址（NEXT_PUBLIC_APP_URL），
  // 这样即使大屏用 localhost 打开，手机扫码也能解析到真实可访问的网址（含端口）。
  const url = new URL(req.url);
  const hostParam = url.searchParams.get('host');
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  let base: string;
  if (envBase && !new URL(envBase).hostname.includes('localhost')) {
    base = envBase;
  } else if (hostParam) {
    base = hostParam.startsWith('http') ? hostParam : `http://${hostParam}`;
  } else {
    const proto = url.protocol || 'http:';
    base = `${proto}//${url.host}`;
  }

  // 若已配置微信网页授权：二维码指向微信授权链接（state=邀请码），扫码即在微信内自动获取昵称；
  // 未配置时降级为普通入场链接（昵称留空，销售简报显示匿名编号）。
  let joinUrl: string;
  if (isWechatConfigured()) {
    joinUrl = buildWechatAuthUrl(base, session.inviteCode);
  } else {
    joinUrl = `${base}/student?code=${session.inviteCode}`;
  }

  const dataUrl = await QRCode.toDataURL(joinUrl, { width: 320, margin: 1 });
  return NextResponse.json({
    joinUrl,
    dataUrl,
    inviteCode: session.inviteCode,
    wechatAuth: isWechatConfigured(),
  });
}
