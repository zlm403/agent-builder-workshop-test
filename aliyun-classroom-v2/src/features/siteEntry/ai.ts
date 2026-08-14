// =========================================================
// A2 快速入门网站 · AI 层（LLM 驱动 · 团队模拟）
// 核心：一个 DeepSeek 分饰多角色（统筹引导/领域专家/网页工程师/体验设计专家）。
// AI 回复时用「【角色名】内容」的格式标记谁在发言，前端据此点亮对应员工卡片。
// 学生说"那你干吧/开始/确定"时，AI 输出建立员工的动作信号。
// =========================================================
import { chatWithLLM } from '@/lib/llm';
import type { ChatMessage } from '@/lib/llm';
import { TEAM_ROLES } from './config';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  speaker?: string; // 发言的角色 label（assistant 时可选）
}

function buildHistory(history: ChatTurn[]): ChatMessage[] {
  return history
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));
}

const SYSTEM_PROMPT = `你是「快速入门网站」课堂里的 AI 团队。团队由 4 个角色组成：
- 统筹引导（🧭）：负责判断需要哪些专家、设计入门路径、分配任务、盯进度、拍板。
- 领域专家（📚）：负责提供所选陌生领域的关键知识、概念、区别、误区和判断方法。
- 网页工程师（💻）：负责把整理好的内容做成适合手机阅读的单页网站，直接给出 HTML 代码。
- 体验设计专家（🎨）：负责设计"让完全陌生的人快速入门"的体验路径。

你的工作方式：
1. 你是"一个团队在开会"。学生问问题，你用多个角色轮流发言，每段发言用这种格式：
【统筹引导】我们先确定这个网站要帮谁、解决什么问题。
【领域专家】这个领域新手最需要先懂的是……
【网页工程师】我可以把它做成这样一页……
2. 每次发言要简短、像真人在开会，不要长篇大论。
3. 学生在"会前准备"阶段会和你商量需要哪些员工。当他确定某个员工时，你用这种格式宣布建立：
【建立】领域专家
（"【建立】"后面紧跟员工名，单独一行，这是给系统的信号）
4. 当学生说"那你干吧""开始做""确定""就这些"之类，进入执行：先宣布【建立】需要的员工，然后团队开始产出内容，最后由网页工程师给出 HTML 代码。
5. 做网站时，网页工程师最终要输出一段完整的、可直接打开的 HTML（含 <!DOCTYPE html> 和样式），做成手机单页。
6. 检验阶段：当学生要求检验，你扮演"小白/目标用户/挑剔客户"等不同的人，按标准检查并给出具体反馈（如"这里我看不懂""第一步不明显"），然后团队讨论修改。

铁律：
- 不要泄露你是 AI 团队模拟，就当作真的团队在协作。
- 发言简短，一次不要超过 3 个角色。
- 【建立】这个信号只在学生确认要某个员工时输出，且必须单独一行、紧跟员工名。`;

export async function a2Chat(history: ChatTurn[]): Promise<{ reply: string; speaker: string | null; built: string | null }> {
  const messages = buildHistory(history);
  const reply = await chatWithLLM(messages, SYSTEM_PROMPT, { temperature: 0.7 });

  // 解析【建立】信号：宣布建立某个员工
  let built: string | null = null;
  const buildMatch = reply.match(/【建立】\s*([^\n【】]+)/);
  if (buildMatch) {
    built = buildMatch[1].trim();
  }

  // 解析最后一段发言的角色（用于前端点亮卡片）
  const speakerMatches = reply.match(/【(统筹引导|领域专家|网页工程师|体验设计专家)】/g);
  const speaker = speakerMatches ? speakerMatches[speakerMatches.length - 1].replace(/【|】/g, '') : null;

  return { reply, speaker, built };
}

// 判断是否要"建立员工"（用户说了干吧/开始等）
export function shouldBuild(text: string): boolean {
  return /那你干吧|开始做|确定|就这些|开始吧|干活|干吧|开工|就按这个/.test(text);
}

// 解析员工名（从学生输入里提取或从【建立】里）
export function parseBuiltRole(text: string): string | null {
  for (const r of TEAM_ROLES) {
    if (text.includes(r.label)) return r.label;
  }
  return null;
}
