import { NextRequest, NextResponse } from 'next/server';
import { getWechatUser } from '@/lib/wechat';

export const dynamic = 'force-dynamic';

// 微信网页授权回调：学生在微信内同意授权后，微信带 code 重定向到这里。
// 我们换取昵称后，再跳转回学生端入场页，把微信昵称作为 URL 参数带回。
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const inviteCode = req.nextUrl.searchParams.get('state') || '';

  if (!code) {
    return NextResponse.redirect(`${req.nextUrl.origin}/student?code=${inviteCode}&wxError=no_code`);
  }

  try {
    const user = await getWechatUser(code);
    const target = `${req.nextUrl.origin}/student?code=${encodeURIComponent(inviteCode)}&wxName=${encodeURIComponent(user.nickname)}`;
    return NextResponse.redirect(target);
  } catch (err) {
    // 授权失败（用户拒绝 / 配置错误）：降级回普通入场页，昵称留空
    return NextResponse.redirect(`${req.nextUrl.origin}/student?code=${encodeURIComponent(inviteCode)}&wxError=1`);
  }
}
