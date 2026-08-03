# Skills 规格文档 V1.0

> **Skill 不是长 Prompt，而是具有明确输入、输出、校验和失败处理的后端能力。**

## 一、Skill 通用接口

```typescript
interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  input: SkillInput;
  output: SkillOutput;
  validation: ValidationRule[];
  fallback: FallbackStrategy;
  configurableParams: ConfigParam[];
}

interface SkillInput {
  systemPrompt: string;          // 系统指令层
  courseConfig: ModuleConfig;    // 课程配置层
  studentInput: Record<string, unknown>; // 学生输入层
  sourceData: string;            // 资料内容层（视为数据，非指令）
  configSnapshot?: AgentConfig;  // 配置快照
  maxTokens?: number;
  temperature?: number;
}

interface SkillOutput {
  schema: JSONSchema;            // 输出 JSON Schema
  example: Record<string, unknown>;
}

interface ValidationRule {
  field: string;
  rule: string;                  // 校验规则表达式
  errorMessage: string;
}

interface FallbackStrategy {
  steps: string[];               // retry_same | retry_format_fix | switch_model | return_error | demo_mode
  maxTotalRetries: number;
}
```

## 二、Skill 清单

### S01: normalize_goal — 任务目标规范化

| 项目 | 内容 |
|---|---|
| 功能 | 把学生模糊的目标转成结构化的任务定义 |
| 触发时机 | A04 短文本提交后 |
| 输入 | `{ target_audience, problem, biggest_issue }` |
| 输出 Schema | `{ serviceTarget, taskDescription, successCriteria, suggestions }` |
| 校验 | `taskDescription` 不为空且 ≥ 20 字；`suggestions` 为非破坏性建议 |
| 失败策略 | 1. 格式修复 2. 原样返回学生输入 + 通用提示 |
| 学生权限 | 必须点击"确认"或自行修改，不能由 AI 静默替换 |

**输出示例：**
```json
{
  "serviceTarget": "正在备考四级的大二学生",
  "taskDescription": "根据四级词汇资料，每次测试5个单词，根据错误记录生成下一轮复习内容",
  "successCriteria": "每轮5词，正确率记录，薄弱词重复出现",
  "suggestions": ["明确词汇范围（如：四级核心词汇/全部大纲词汇）", "增加例句测试"]
}
```

### S02: process_source — 资料处理

| 项目 | 内容 |
|---|---|
| 功能 | 清洗并切分学生提交的资料文本 |
| 触发时机 | A05 资料提交后 |
| 输入 | `{ rawText, sourceType }` |
| 输出 Schema | `{ title, wordCount, chapters: [{id, title, content, knowledgePoints}] }` |
| 校验 | 章节数 ≥ 1；知识点的引用位置可回溯；长度 < 50000 字 |
| 失败策略 | 1. 重试 2. 返回原始文本 + 标注处理失败 3. 建议使用示例资料 |
| 安全控制 | 拒绝包含身份证号、手机号等敏感信息的资料 |

### S03: build_agent_config — 配置构建

| 项目 | 内容 |
|---|---|
| 功能 | 将学生的选择组合成结构化 AgentConfig |
| 触发时机 | A06 规则配置完成 |
| 输入 | `{ selections: Record<string, string>, projectId }` |
| 输出 Schema | `AgentConfig` （见 DATA_MODELS.md） |
| 校验 | 所有必填字段存在；规则无逻辑冲突 |
| 失败策略 | 不调用 AI，纯逻辑构建，失败返回字段校验错误 |

### S04: validate_rules — 规则校验

| 项目 | 内容 |
|---|---|
| 功能 | 检查 AgentConfig 中的规则是否冲突或缺失 |
| 触发时机 | A06 配置完成时自动触发 |
| 输入 | `AgentConfig` |
| 输出 Schema | `{ valid: boolean, errors: [], warnings: [], suggestions: [] }` |
| 校验 | 输出格式固定 |
| 失败策略 | 规则逻辑分析 → 标记不确定项 |

### S05: validate_workflow — 工作流校验

| 项目 | 内容 |
|---|---|
| 功能 | 检查工作流步骤顺序和依赖是否合理 |
| 触发时机 | A07 工作流配置完成 |
| 输入 | `{ steps: WorkflowStep[] }` |
| 输出 Schema | `{ valid: boolean, issues: [{stepId, problem, suggestion}] }` |
| 校验 | 必要步骤（读取资料、生成问题、等待回答、判断答案）存在 |
| 失败策略 | 标记可疑步骤，不阻断 |

### S06: run_learning_agent — 执行学习 Agent

| 项目 | 内容 |
|---|---|
| 功能 | 根据 AgentConfig + 资料 + 工作流执行资料型 Agent |
| 触发时机 | A08/A09/A11 |
| 输入 | `{ configSnapshot: AgentConfig, sourceData, workflowSteps, userMessage, runType }` |
| 输出 Schema | 见下方 |
| 校验 | 必须返回 JSON；引用 sourceId 必须可映射 |
| 失败策略 | 标准五步容灾流程 |
| 超时 | 20 秒 |

**输出 Schema（以复习教练为例）：**
```json
{
  "status": "success",
  "knowledgePoint": "导数定义",
  "question": "...",
  "answer": "...",
  "explanation": "...",
  "citations": [{ "sourceId": "s1", "chapter": "ch1", "quote": "..." }],
  "outsideSource": false,
  "waitingForAnswer": true,
  "previousErrorRecorded": true
}
```

### S07: run_test_suite — 执行标准测试

| 项目 | 内容 |
|---|---|
| 功能 | 对 Agent 执行三类标准测试 |
| 触发时机 | A09 |
| 输入 | `{ projectId, configVersionId }` |
| 测试项 | 1. 正常请求 2. 越界请求 3. 流程干扰 |
| 输出 Schema | `{ tests: [{ type, input, output, passed, issues }] }` |
| 测试输入统一化 | 所有学生使用相同测试文本 |

### S08: evaluate_output — 输出评估

| 项目 | 内容 |
|---|---|
| 功能 | 按量表检查 AI 运行结果 |
| 触发时机 | A10 诊断 + A14 对比 |
| 输入 | `{ runId, dimensions: string[] }` |
| 输出 Schema | `{ evaluations: [{ dimension, score, evidence }] }` |
| 校验 | 每个分数有引用证据 |
| 特殊要求 | 不依赖模型自报的 confidence |

### S09: suggest_revision — 修改建议

| 项目 | 内容 |
|---|---|
| 功能 | 根据诊断结果提出规则修改建议 |
| 触发时机 | A10 诊断完成 |
| 输入 | `{ configVersionId, evaluationResults, flaggedIssues }` |
| 输出 Schema | `{ suggestions: [{ targetRule, suggestedChange, reasoning, priority }] }` |
| 关键约束 | 建议项，不自动强制采纳；学生必须手动确认 |

### S10: compare_runs — 运行对比

| 项目 | 内容 |
|---|---|
| 功能 | 对比 V1 和 V2 运行结果 |
| 触发时机 | A12 前后对比 |
| 输入 | `{ run1Id, run2Id }` |
| 输出 Schema | `{ comparisons: [{ dimension, v1, v2, change, improved }] }` |
| 关键约束 | 不假装所有指标一定改善；未解决项明确显示 "unresolved" |

### S11: publish_project — 作品发布

| 项目 | 内容 |
|---|---|
| 功能 | 生成作品页和分享码 |
| 触发时机 | A13 发布 |
| 输入 | `{ projectId, visibility, configVersionIds }` |
| 输出 Schema | `{ workId, shareCode, publicUrl }` |
| 类型 | 纯逻辑操作，不调用 AI |

### S12: moderate_content — 内容审核

| 项目 | 内容 |
|---|---|
| 功能 | 检查输入、输出和昵称的安全性 |
| 触发时机 | 所有用户输入和 AI 输出 |
| 输入 | `{ contentType, content, context }` |
| 输出 Schema | `{ allowed: boolean, risk: 'low'|'medium'|'high', action: 'allow'|'flag'|'block', reason? }` |
| 触发点 | 昵称设置、资料上传、AI 输入输出、作品名称和描述 |

### S13: generate_report — 能力报告

| 项目 | 内容 |
|---|---|
| 功能 | 形成学生能力报告 |
| 触发时机 | A16 课程路径 |
| 输入 | `{ participantId, projectId, evaluationHistory }` |
| 输出 Schema | `{ completedAbilities: string[], nextDirections: string[], strengths: string[], growthAreas: string[] }` |

### S14: classroom_fallback — 课堂降级

| 项目 | 内容 |
|---|---|
| 功能 | AI 失败时执行降级 |
| 触发时机 | 任何 AI 调用全链路失败 |
| 输入 | `{ failedSkill, context, errorInfo }` |
| 策略 | 1. 备用模型 2. 预生成示例 3. 演示模式（标注） |
| 约束 | 演示模式必须明确标注，不能冒充实时结果 |

## 三、AI 调用容灾流程（五步法）

```
调用 Skill
  ├─ 成功 + Schema 校验通过 → 返回结果
  ├─ Schema 校验失败 → Step 1: 同模型格式修复
  │   ├─ 成功 → 返回结果
  │   └─ 失败 → Step 2: 原任务重试一次
  │       ├─ 成功 → 返回结果
  │       └─ 失败 → Step 3: 切换备用模型
  │           ├─ 成功 → 返回结果
  │           └─ 失败 → Step 4: 返回明确错误信息
  │               └─ Step 5: 经教师允许进入演示模式
```

## 四、每个 Skill 必须通过独立测试

不能只通过整堂课人工演示判断可用。每个 Skill 需要：

1. **单元测试**：固定输入 → 预期输出验证
2. **边界测试**：空输入、超长输入、非法字符、SQL 注入文本
3. **Schema 测试**：输出是否符合 JSON Schema
4. **容灾测试**：模拟 API 超时、返回乱码、断连
5. **事实核验测试**：输出引用是否真实存在于输入资料中
