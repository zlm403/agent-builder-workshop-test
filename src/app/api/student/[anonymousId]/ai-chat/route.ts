export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatWithLLM, LLMError } from '@/lib/llm';
import { publish } from '@/lib/realtime';
import { getTemplate } from '@/lib/courseConfig';
import type { A01OperationData, A01Turn } from '@/lib/analytics';

const MATERIAL_KW = ['资料', '材料', '词库', '词汇', '四级', '400 词', '单词', '根据', '依据'];
const VERIFY_KW = ['依据', '核对', '检查', '验证', '原文找', '能否在原文', '出处'];
const MODIFY_KW = ['修改', '调整', '重新', '改一下', '优化', '更正'];

// 中性 SYSTEM：只按学生要求回应，不主动教方法、不给标准提示词、不报评分标准。
const SYSTEM = `你是英语学习设计助手。学生正在用 AI 完成一次真实的四级词汇 10 天急救计划设计任务。

请严格按照学生提出的要求来回应，做到：
1. 不主动拆解任务、不主动追问学习对象或薄弱点；
2. 不主动给出所谓“标准提示词”或“满分指令”；
3. 不主动讲解评分标准或“正确做法”。

如果学生提出的要求已经足够具体，就直接高质量地完成；如果学生只给了模糊指令，就按字面正常生成一份结果即可，不要替学生把任务“想得更清楚”。`;

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
    const helpUsed: boolean = !!body.helpUsed;
    const framework: Record<string, string> | undefined = body.framework;

    const p = await prisma.participant.findUnique({ where: { anonymousId: params.anonymousId } });
    if (!p) return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 404 });

    const session = await prisma.classSession.findUnique({ where: { id: p.sessionId } });
    if (!session) return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 });
    if (session.moduleLocked && !submit) {
      return NextResponse.json({ error: { code: 'MODULE_LOCKED' } }, { status: 400 });
    }

    // 支持任意 ai_task 模块（A01 基线 / A03 第二轮），按当前模块动态存储
  const MODULE_ID = session.currentModuleId;
  if (!MODULE_ID) {
    return NextResponse.json({ error: { code: 'MODULE_NOT_ACTIVE' } }, { status: 400 });
  }
  const mod = getTemplate().modules.find((m) => m.id === MODULE_ID);
  if (!mod || mod.type !== 'ai_task') {
      return NextResponse.json({ error: { code: 'MODULE_NOT_ACTIVE', current: MODULE_ID } }, { status: 400 });
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
      helpUsed: false,
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

    if (helpUsed) data.helpUsed = true;
    if (framework) data.framework = framework;

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

    publish(p.sessionId, { type: 'analytics:update', payload: { moduleId: MODULE_ID } });

    return NextResponse.json({
      reply,
      turns: data.turns,
      profile: {
        usedMaterial: data.usedMaterial,
        verified: data.verified,
        modified: data.modified,
        helpUsed: data.helpUsed,
        rounds: data.turns.filter((t) => t.role === 'user').length,
      },
    });
  } catch (err) {
    if (err instanceof LLMError) {
      const friendly: Record<LLMError['code'], string> = {
        TIMEOUT: 'AI 响应超时，请稍后重试',
        SERVICE_BUSY: 'AI 服务繁忙，请稍后再试',
        AUTH: '教师端 API Key 无效，请在「设置」中检查',
        RATE_LIMIT: 'AI 请求过快，请稍后重试',
        NETWORK: '网络异常，请稍后重试',
        EMPTY: 'AI 返回为空，请稍后重试',
        UNKNOWN: 'AI 调用失败，请稍后重试',
      };
      return NextResponse.json(
        { error: { code: 'LLM_' + err.code, message: friendly[err.code] } },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: { code: 'CHAT_FAILED', message: '服务异常，请稍后重试' } },
      { status: 500 },
    );
  }
}
