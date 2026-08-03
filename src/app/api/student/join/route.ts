import { NextRequest, NextResponse } from 'next/server';
import { joinClassroom } from '@/lib/classroom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
    const invitationCode = String(body.invitationCode || '').trim().toUpperCase();
    const nickname = String(body.nickname || '').trim();
    const wechatName = String(body.wechatName || '').trim();
    const wechatOpenid = String(body.wechatOpenid || '').trim();
    if (!inviteCode) return NextResponse.json({ error: { code: 'INVALID_CODE' } }, { status: 400 });
    if (!invitationCode) return NextResponse.json({ error: { code: 'INVITATION_REQUIRED' } }, { status: 400 });

    const result = await joinClassroom(inviteCode, {
      nickname: nickname || undefined,
      wechatName: wechatName || undefined,
      wechatOpenid: wechatOpenid || undefined,
      invitationCode,
      deviceInfo: body.deviceInfo,
      consentPrivacy: body.consentPrivacy !== false,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = String(err);
    const code = message.includes('INVALID_CODE')
      ? 'INVALID_CODE'
      : message.includes('SESSION_CLOSED')
        ? 'SESSION_CLOSED'
        : message.includes('SESSION_ENDED')
          ? 'SESSION_ENDED'
          : message.includes('INVALID_INVITATION')
          ? 'INVALID_INVITATION'
          : message.includes('INVITATION_USED')
            ? 'INVITATION_USED'
            : 'JOIN_FAILED';
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }
}
