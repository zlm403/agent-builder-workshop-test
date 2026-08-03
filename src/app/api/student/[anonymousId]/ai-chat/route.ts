import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatWithLLM } from '@/lib/llm';
import { publish } from '@/lib/realtime';
import type { A01OperationData, A01Turn } from '@/lib/analytics';

const MATERIAL_KW = ['资料', '材料', '小林', '阅读', '原文', '根据', '依据'];
const VERIFY_KW = ['依据', '核对', '检查', '验证', '原文找', '能否在原文', '出处'];
const MODIFY_KW = ['修改', '调整', '重新', '改一下', '优化', '更正'];

const MODULE_ID = 'A01_BASELINE';
const SYSTEM = `你是 AI 教学设计助手。学生正在完成 A1 任务：阅读一份关于"小林考研英语阅读"的材料，并指挥 AI 完成四项工作——诊断问题、设计 30 分钟训练、生成测试题、检查依据。

默认节奏：每次回复只推进当前这一步，并给出下一步的可复制提示语，方便学生练习"如何向 AI 发指令"。
触发条件：如果学生明确说"直接给我完整方案""不要分步""一次性说完""直接做""不要我提醒"或类似表达，则把剩余步骤一次性完整输出，不要再一步步追问。

要求：
1. 每一步结论必须能指回材料原文，避免常识推断；
2. 训练设计要具体、可执行、时间明确；
3. 测试题必须有答案和原文依据；
4. 检查依据时要指出"原文哪里支持、哪里不支持"。`;

function detect(message: string, prev: boolean, kw: string[]): boolean {
  return prev || kw.some((k) => message.includes(k));
}

export async function POST(req: NextRequest, { params }: { params: { anonymousId: string } }) {
  try {
    const body = await req.json();
    const message: string = String(body.message ?? '').trim();
    const materialReferenced: boolean = !!body.materialReferenced;
    const submit: boolean = !!body.submit;
    const finalText: string = String(body.finalText ?? '');

    const p = await prisma.participant.findUnique({ where: { anonymousId: params.anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });

    const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
    if (!session) return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 });
    if (session.moduleLocked && !submit) {
      return NextResponse.json({ error: { code: 'MODULE_LOCKED' } }, { status: 400 });
    }
    if (session.currentModuleId !== MODULE_ID) {
      return NextResponse.json({ error: { code: 'MODULE_NOT_ACTIVE', current: session.currentModuleId } }, { status: 400 });
    }

    const where = { participantId_moduleId: { participantId: p.id, moduleId: MODULE_ID } };
    const existing = await prisma.moduleProgress.findUnique({ where });

    const data: A01OperationData = (existing?.data as unknown as A01OperationData) ?? {
      moduleId: MODULE_ID,
      startedAt: Date.now(),
      turns: [],
      usedMaterial: false,
      verified: false,
      modified: false,
      firstUserPrompt: '',
    };

    if (!data.startedAt) data.startedAt = Date.now();
    if (!data.turns) data.turns = [];
    if (!data.moduleId) data.moduleId = MODULE_ID;

    let reply = '';

    if (message) {
      if (!data.firstUserPrompt) data.firstUserPrompt = message;
      data.turns.push({ role: 'user', content: message, at: Date.now() });
      data.usedMaterial = detect(message, data.usedMaterial, MATERIAL_KW) || materialReferenced;
      data.verified = detect(message, data.verified, VERIFY_KW);
      data.modified = detect(message, data.modified, MODIFY_KW);

      const chatMessages = data.turns
        .filter((t) => t.role === 'user' || t.role === 'assistant')
        .map((t: A01Turn) => ({ role: t.role, content: t.content }));
      reply = await chatWithLLM(chatMessages, SYSTEM);
      data.turns.push({ role: 'assistant', content: reply, at: Date.now() });
    }

    let status = existing?.status ?? 'entered';
    if (submit) {
      data.finalText = finalText || data.turns.map((t) => (t.role === 'user' ? t.content : '')).join('\n');
      data.submittedAt = Date.now();
      status = 'submitted';
    }

    const baseData = {
      status,
      data: data as object,
      ...(submit ? { submittedAt: new Date() } : {}),
    };
    await prisma.moduleProgress.upsert({
      where,
      create: {
        participantId: p.id,
        sessionId: p.sessionId,
        moduleId: MODULE_ID,
        ...baseData,
        submittedAt: submit ? new Date() : null,
      },
      update: baseData,
    });

    // 实时通知教师端/大屏重新拉取分析
    publish(p.sessionId, { type: 'analytics:update', payload: { moduleId: MODULE_ID } });

    return NextResponse.json({
      reply,
      turns: data.turns,
      profile: {
        usedMaterial: data.usedMaterial,
        verified: data.verified,
        modified: data.modified,
        rounds: data.turns.filter((t) => t.role === 'user').length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CHAT_FAILED', message: String(err) } }, { status: 500 });
  }
}
