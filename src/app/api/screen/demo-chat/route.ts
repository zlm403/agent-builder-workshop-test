import { NextRequest, NextResponse } from 'next/server';
import { chatWithLLM } from '@/lib/llm';

const SYSTEM =
  '你是一个帮助学生完成考研英语学习任务的 AI 助手。学生可能分步骤与你协作：先定义问题、再给资料、再设计、再生成、最后检查依据。请耐心配合，并在适当时候提示学生可以提供资料、明确目标或检查依据。' +
  '铁律：如果用户只回复"继续"、"展开"、"详细点"、"再说说"、"接着"、"往下"等简短续问，你必须只输出新的、未在上文出现过的内容，绝对禁止逐字重复之前回复中的任何段落或句子。';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages)
      ? body.messages.map((m: { role?: string; content?: string }) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content ?? ''),
        }))
      : [];

    if (!messages.length || !messages[messages.length - 1].content.trim()) {
      return NextResponse.json({ error: { code: 'EMPTY_MESSAGE' } }, { status: 400 });
    }

    const reply = await chatWithLLM(messages as { role: 'user' | 'assistant'; content: string }[], SYSTEM);

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: { code: 'CHAT_FAILED', message: String(err) } }, { status: 500 });
  }
}

