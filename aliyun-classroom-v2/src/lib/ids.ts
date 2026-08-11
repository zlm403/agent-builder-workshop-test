import { randomBytes, randomUUID } from 'crypto';
import { prisma } from './db';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符

export function generateInviteCode(len = 6): string {
  let out = '';
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

export function generateResumeToken(): string {
  return 'rt_' + randomUUID().replace(/-/g, '');
}

export async function generateAnonymousId(sessionId: string, version: string): Promise<string> {
  const prefix = (version || 'A').toUpperCase().charAt(0);
  // 基于本课堂已加入人数生成序号，并全局去重（anonymousId 在 Participant 表上唯一）
  let count = await prisma.participant.count({ where: { sessionId } });
  let seq = count + 1;
  while (true) {
    const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    const existing = await prisma.participant.findUnique({ where: { anonymousId: candidate } });
    if (!existing) return candidate;
    seq++;
  }
}
