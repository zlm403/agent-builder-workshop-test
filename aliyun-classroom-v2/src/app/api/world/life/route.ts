export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { upsertLife, readControl } from '@/lib/world/store';
import { textToTraits } from '@/lib/world/traits';

// 学生提交生命：用一段文字描述生命定义，后端翻译成三个内部倾向值。
// V1 按文字驱动：学生写"它喜欢……"，AI/规则转成引擎能用的数值。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sid = String(body.anonymousId || '');
  const name = String(body.name || '').trim();
  const color = String(body.color || '#36CFC9');
  const version = Number(body.version || 1);
  // 文字是生命定义的唯一输入；留空时用默认中性倾向
  const text = String(body.text || '').trim();

  if (!sid || !name) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'anonymousId and name required' } }, { status: 400 });
  }

  // 世界自动运行：不做阶段限制，任何版本都可提交（提交即发布/生效）

  // 文字 → 三个内部倾向
  const traits = text ? await textToTraits(text) : { social: 0.5, helpful: 0.5, cautious: 0.5, advice: '' };

  const lives = upsertLife(sid, {
    name,
    color,
    version,
    text: text || '',
    social: traits.social,
    helpful: traits.helpful,
    cautious: traits.cautious,
  });
  const my = lives.lives.find((l) => l.sid === sid);
  return NextResponse.json({
    ok: true,
    life: my,
    traits: { social: traits.social, helpful: traits.helpful, cautious: traits.cautious },
  });
}
