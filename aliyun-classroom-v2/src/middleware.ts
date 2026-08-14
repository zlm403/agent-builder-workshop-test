import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 给页面 HTML 加 no-store，避免浏览器强缓存旧版本（部署后硬刷新也刷不出新内容）
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // 只对页面路由（非 api、非静态资源）设置
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/story/') || pathname.startsWith('/media/')) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
