// 微信网页授权（OAuth2, scope=snsapi_userinfo）
// 用途：学生用微信扫码进入课堂时，自动获取其微信昵称（nickname），
// 与系统分配的匿名编号（anonymousId）一一对应，最终在销售简报中呈现真实微信名。
//
// 前提（需部署方配置，开发环境可留空自动降级）：
//   WECHAT_APPID        已认证公众号（服务号）的 AppID
//   WECHAT_APPSECRET    对应 AppSecret
//   - 公众号后台配置“网页授权域名”为部署域名（必须 HTTPS、已备案）
//   - 该域名需能访问本服务的 /api/wechat/oauth/callback
//
// 流程：二维码 = 微信授权链接（state=课堂邀请码）
//   → 学生在微信内同意授权
//   → 微信重定向到 /api/wechat/oauth/callback?code=CODE&state=INVITE
//   → 后端用 code 换 openid + nickname
//   → 302 跳转回 /student?code=INVITE&wxName=昵称
//   → 学生端 join 时把 wxName 写入 participant.wechatName

export interface WechatUser {
  openid: string;
  nickname: string;
  headimgurl: string;
}

export function isWechatConfigured(): boolean {
  return !!process.env.WECHAT_APPID && !!process.env.WECHAT_APPSECRET;
}

/** 生成微信网页授权链接；redirectBase 必须是公众号后台配置的网页授权域名（公网 HTTPS）。 */
export function buildWechatAuthUrl(redirectBase: string, inviteCode: string): string {
  const appid = process.env.WECHAT_APPID!;
  const redirectUri = encodeURIComponent(`${redirectBase}/api/wechat/oauth/callback`);
  // scope=snsapi_userinfo：弹出授权页，可获取用户昵称/头像
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${encodeURIComponent(inviteCode)}#wechat_redirect`;
}

/** 用授权 code 换取用户昵称/头像。仅在微信回调时使用。 */
export async function getWechatUser(code: string): Promise<WechatUser> {
  const appid = process.env.WECHAT_APPID!;
  const secret = process.env.WECHAT_APPSECRET!;

  const timeout = (ms: number) =>
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('wechat_timeout')), ms));

  // 换取 access_token：secret 放 POST body，避免拼在 URL 出现在服务器日志（P0-12）
  const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&code=${code}&grant_type=authorization_code`;
  const tokenRes = await Promise.race([
    fetch(tokenUrl, { method: 'POST', body: new URLSearchParams({ secret }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    timeout(8000),
  ]);
  if (!tokenRes.ok) throw new Error(`wechat_token_http:${tokenRes.status}`);
  const token = await tokenRes.json();
  if (!token.access_token) {
    throw new Error(`wechat_token_failed:${token.errcode || ''} ${token.errmsg || ''}`);
  }

  const infoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${token.access_token}&openid=${token.openid}&lang=zh_CN`;
  const infoRes = await Promise.race([fetch(infoUrl), timeout(8000)]);
  if (!infoRes.ok) throw new Error(`wechat_userinfo_http:${infoRes.status}`);
  const info = await infoRes.json();
  if (!info.openid) {
    throw new Error(`wechat_userinfo_failed:${info.errcode || ''} ${info.errmsg || ''}`);
  }

  return {
    openid: info.openid,
    nickname: info.nickname || '',
    headimgurl: info.headimgurl || '',
  };
}
