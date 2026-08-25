export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { upsertLife } from '@/lib/world/store';
import { LIFE_PRESETS } from '@/lib/world/presets';
import { textToTraits } from '@/lib/world/traits';
import { ruleSpec } from '@/lib/world/spec';

// 教师端一键添加预置生命（如张老师鱼缸例子）进世界
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const presetId = String(body.presetId || '');
  const preset = LIFE_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    return NextResponse.json({ error: { code: 'BAD_PRESET', message: presetId } }, { status: 400 });
  }
  // 每次添加生成唯一 sid（避免覆盖），可多次添加
  const sid = `${preset.sid}_${Date.now().toString(36)}`;
  const traits = await textToTraits(preset.text);
  const lives = upsertLife(sid, {
    name: preset.name,
    color: preset.color,
    version: 1,
    text: preset.text,
    shape: preset.shape,
    spec: ruleSpec(preset.text),
    social: traits.social,
    helpful: traits.helpful,
    cautious: traits.cautious,
  });
  const my = lives.lives.find((l) => l.sid === sid);
  return NextResponse.json({ ok: true, life: my, preset: { id: preset.id, name: preset.name } });
}
