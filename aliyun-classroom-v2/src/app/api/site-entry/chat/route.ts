import { NextRequest, NextResponse } from 'next/server';
import { a2Chat, shouldBuild, parseBuiltRole } from '@/features/siteEntry/ai';
import { TEAM_ROLES, findTeamRole } from '@/features/siteEntry/config';
import { getA2Record, ensureA2Record, appendChat, saveTeam, saveSiteCode } from '@/features/siteEntry/store';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = String(body.anonymousId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const message = String(body.message ?? '').trim();
    if (!anonymousId || !sessionId || !message) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST' } }, { status: 400 });
    }

    const participant = await prisma.participant.findUnique({ where: { anonymousId } });
    if (!participant) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 403 });

    await ensureA2Record(sessionId, anonymousId, participant.id);
    const rec = await getA2Record(sessionId, anonymousId);
    const prevChat = (rec?.chatLog as any[]) ?? [];
    const chatLog = [...prevChat, { role: 'user', content: message }];

    const { reply, speaker, built } = await a2Chat(chatLog);

    // 更新对话记录
    const newChat = [...chatLog, { role: 'assistant', content: reply, speaker: speaker ?? undefined }];
    await appendChat(sessionId, anonymousId, newChat);

    // 若 AI 宣布建立员工，更新团队
    let team: any[] = (rec?.team as any[]) ?? [];
    const builtLabel = built ?? (shouldBuild(message) ? parseBuiltRole(reply) : null);
    if (builtLabel) {
      const role = TEAM_ROLES.find((r) => r.label === builtLabel) ?? findTeamRole(builtLabel);
      if (role && !team.some((t) => t.id === role.id)) {
        team = [...team, { id: role.id, label: role.label, icon: role.icon, duty: role.duty }];
        await saveTeam(sessionId, anonymousId, team);
      }
    }

    // 若 AI 输出了可运行的网站 HTML，持久化供作品墙上墙
    const html = reply.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (html) {
      await saveSiteCode(sessionId, anonymousId, html[0]);
    }

    return NextResponse.json({ reply, speaker, built: builtLabel, team, hasSite: !!html });
  } catch (e: any) {
    return NextResponse.json({ error: { code: 'SERVER', message: String(e) } }, { status: 500 });
  }
}
