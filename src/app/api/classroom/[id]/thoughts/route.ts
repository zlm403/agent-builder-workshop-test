import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

// 弹幕内容安全：长度上限 + 禁字整条拒 + 词组替换 + 归一化防绕过
const MAX_LEN = 60;

// 命中即整条拒绝（不替换展示）：不雅/攻击性强的字
const REJECT_CHARS = ['屎', '尿', '屁', '屌', '逼', '肏', '婊', '贱'];

// 命中即整条拒绝的敏感词组
const REJECT_WORDS = ['去死', '滚蛋', '狗日', '傻x', 'sb', 'nmd', 'cnm', 'fuck', 'shit', 'bitch', '操你', '傻b', '煞笔'];

// 命中即替换为 * 的温和词（保留语气、遮住脏词）
const REPLACE_WORDS = ['傻逼', '妈的', '妈逼', '笨蛋', '白痴', '草泥马', '脑残', '智障'];

// 归一化：去空白/标点/符号/小写，用于防止 "傻 逼" 这类插入绕过
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function sanitize(text: string): { ok: boolean; text: string } {
  let t = (text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_LEN);
  // 温和词：先替换为 *，避免其内含的禁字（如“逼”）导致整条被拒
  for (const w of REPLACE_WORDS) {
    t = t.split(w).join('*'.repeat(w.length));
  }
  // 禁字/禁词组（对替换后的文本归一化检查）：整条拒绝
  const n = normalize(t);
  if ([...REJECT_CHARS, ...REJECT_WORDS].some((w) => n.includes(normalize(w)))) {
    return { ok: false, text: t };
  }
  return { ok: true, text: t };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) {
    return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 });
  }
  const thoughts = await prisma.entryThought.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, text: true, anonymousId: true, createdAt: true },
  });
  return NextResponse.json({ thoughts });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) {
    return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 });
  }
  if (session.status === 'ended' || session.status === 'closed') {
    return NextResponse.json({ error: { code: 'SESSION_CLOSED' } }, { status: 400 });
  }
  let body: { anonymousId?: string; text?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* noop */
  }
  const clean = sanitize(body.text ?? '');
  if (!clean.text) {
    return NextResponse.json({ error: { code: 'EMPTY_TEXT' } }, { status: 400 });
  }
  if (!clean.ok) {
    return NextResponse.json({ error: { code: 'CENSORED' } }, { status: 400 });
  }
  const participant = await prisma.participant.findFirst({
    where: { sessionId: params.id, anonymousId: body.anonymousId ?? '' },
  });
  if (!participant) {
    return NextResponse.json({ error: { code: 'NOT_JOINED' } }, { status: 400 });
  }
  const thought = await prisma.entryThought.create({
    data: {
      sessionId: params.id,
      participantId: participant.id,
      anonymousId: participant.anonymousId,
      text: clean.text,
    },
  });
  // 实时推送给大屏：开课前暖场弹幕
  publish(params.id, {
    type: 'thought:new',
    payload: { id: thought.id, text: thought.text, anonymousId: thought.anonymousId, createdAt: thought.createdAt },
  });
  return NextResponse.json({ thought });
}
