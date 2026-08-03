# 数据模型定义 V1.0

## 一、实体关系概览

```text
CourseTemplate 1──N ClassSession
ClassSession   1──N Participant
ClassSession   1──N ModuleProgress
Participant    1──N ModuleProgress
Participant    1──N AgentProject
AgentProject   1──N AgentConfigVersion
AgentProject   1──N SourceDocument
AgentProject   1──N WorkflowDefinition
AgentProject   1──N AIRun
AIRun          1──N Evaluation
AgentProject   1──1 PublishedWork
PublishedWork  1──N PeerFeedback
Participant    1──N ConsentRecord
Participant    1──N EnrollmentEvent
ClassSession   1──N AuditLog
```

## 二、核心实体

### 2.1 CourseTemplate（课程模板）

```prisma
model CourseTemplate {
  id            String   @id @default(uuid())
  version       String                       // "A" | "B"
  name          String                       // 课程名称
  subtitle      String                       // 副标题
  modules       Json                         // ModuleConfig[]
  status        String   @default("draft")   // draft | active | archived
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### 2.2 ClassSession（课堂实例）

```prisma
model ClassSession {
  id              String   @id @default(uuid())
  templateId      String                       // FK → CourseTemplate
  teacherId       String                       // 教师标识
  inviteCode      String   @unique             // 6位邀请码
  status          String   @default("pending") // pending|active|paused|ended
  currentModuleId String?                       // 当前教学模块
  moduleLocked    Boolean  @default(false)      // 是否锁定学生任务
  startedAt       DateTime?
  endedAt         DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  template        CourseTemplate  @relation(fields: [templateId], references: [id])
  participants    Participant[]
  auditLogs       AuditLog[]
  @@index([inviteCode])
  @@index([teacherId])
}
```

### 2.3 Participant（匿名学生）

```prisma
model Participant {
  id            String   @id @default(uuid())
  sessionId     String                        // FK → ClassSession
  anonymousId   String   @unique              // 匿名ID，如 "A023"
  nickname      String                        // 自选昵称
  resumeToken   String   @unique              // 断线恢复令牌
  deviceInfo    Json?                         // 设备信息
  connected     Boolean  @default(true)
  joinedAt      DateTime @default(now())
  lastSeenAt    DateTime @default(now())

  session         ClassSession      @relation(fields: [sessionId], references: [id])
  moduleProgress  ModuleProgress[]
  agentProjects   AgentProject[]
  consentRecords  ConsentRecord[]
  enrollmentEvents EnrollmentEvent[]

  @@index([sessionId])
  @@index([anonymousId])
}
```

### 2.4 ModuleProgress（模块进度）

```prisma
model ModuleProgress {
  id            String   @id @default(uuid())
  participantId String                        // FK → Participant
  sessionId     String                        // FK → ClassSession (冗余加速查询)
  moduleId      String                        // 如 "A05_ADD_SOURCE"
  status        String   @default("pending")  // pending|entered|submitted|completed|stuck|skipped
  submittedAt   DateTime?
  completedAt   DateTime?
  data          Json?                         // 学生提交的数据
  aiCallsCount  Int      @default(0)          // 本模块 AI 调用次数
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  participant Participant @relation(fields: [participantId], references: [id])
  session     ClassSession @relation(fields: [sessionId], references: [id])

  @@unique([participantId, moduleId])
  @@index([sessionId, moduleId, status])
}
```

### 2.5 AgentProject（学生作品）

```prisma
model AgentProject {
  id            String   @id @default(uuid())
  participantId String                        // FK → Participant
  sessionId     String                        // FK → ClassSession
  name          String                        // Agent 名称
  taskType      String                        // 任务类型: review_coach|english|exam|cert|interview
  goal          String                        // 任务目标描述
  status        String   @default("draft")    // draft|running|published
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  participant       Participant          @relation(fields: [participantId], references: [id])
  configVersions    AgentConfigVersion[]
  sourceDocs        SourceDocument[]
  workflows         WorkflowDefinition[]
  aiRuns            AIRun[]
  publishedWork     PublishedWork?
}
```

### 2.6 AgentConfigVersion（配置版本）

> **关键约束：任何修改不得覆盖旧版本。首次运行绑定 V1，二次运行绑定 V2。**

```prisma
model AgentConfigVersion {
  id            String   @id @default(uuid())
  projectId     String                        // FK → AgentProject
  version       Int                           // 1, 2, ...
  config        Json                          // 完整配置快照
  rules         Json                          // 规则列表
  workflowRefId String?                       // FK → WorkflowDefinition
  isActive      Boolean  @default(false)      // 当前激活版本
  createdAt     DateTime @default(now())

  project  AgentProject        @relation(fields: [projectId], references: [id])
  aiRuns   AIRun[]

  @@unique([projectId, version])
}
```

### 2.7 SourceDocument（资料文档）

```prisma
model SourceDocument {
  id            String   @id @default(uuid())
  projectId     String                        // FK → AgentProject
  title         String                        // 资料标题
  sourceType    String                        // example|paste|upload|photo
  rawText       String?                       // 原始文本
  parsedJson    Json?                         // 解析后的结构化内容
  chapters      Json?                         // 章节列表
  knowledgePoints Json?                       // 知识点列表
  status        String   @default("processing") // processing|ready|failed
  createdAt     DateTime @default(now())

  project AgentProject @relation(fields: [projectId], references: [id])
}
```

### 2.8 WorkflowDefinition（工作流定义）

```prisma
model WorkflowDefinition {
  id        String   @id @default(uuid())
  projectId String                        // FK → AgentProject
  steps     Json                           // Step[] 有序步骤列表
  version   Int      @default(1)
  createdAt DateTime @default(now())

  project AgentProject @relation(fields: [projectId], references: [id])
}
```

### 2.9 AIRun（AI 调用记录）

```prisma
model AIRun {
  id            String   @id @default(uuid())
  projectId     String                        // FK → AgentProject
  configVersionId String                      // FK → AgentConfigVersion (关联版本)
  skillName     String                        // 调用的 Skill 名称
  runType       String                        // first_run|second_run|test_normal|test_boundary|test_disrupt
  inputSummary  String                        // 输入摘要
  outputJson    Json?                         // 结构化输出
  rawOutput     String?                       // 原始输出
  durationMs    Int                           // 耗时(毫秒)
  status        String                        // success|failed|fallback|timeout
  modelUsed     String                        // 使用的模型标识
  schemaValid   Boolean                       // Schema 校验是否通过
  factCheckPass Boolean?                      // 事实核验是否通过
  errorMessage  String?                       // 错误信息
  retryCount    Int      @default(0)
  createdAt     DateTime @default(now())

  project       AgentProject        @relation(fields: [projectId], references: [id])
  configVersion AgentConfigVersion  @relation(fields: [configVersionId], references: [id])
  evaluations   Evaluation[]
}
```

### 2.10 Evaluation（评估记录）

```prisma
model Evaluation {
  id        String   @id @default(uuid())
  runId     String                        // FK → AIRun
  evaluator String                        // "student" | "system" | "peer"
  dimensions Json                          // [{ name: string, score: number, comment?: string }]
  issues    Json?                         // 标记的问题列表
  createdAt DateTime @default(now())

  run AIRun @relation(fields: [runId], references: [id])
}
```

### 2.11 PeerFeedback（互测反馈）

```prisma
model PeerFeedback {
  id            String   @id @default(uuid())
  workId        String                        // FK → PublishedWork
  reviewerId    String                        // FK → Participant
  usefulPoint   String?                       // 最有用的地方
  improvePoint  String?                       // 最需要修改的地方
  wouldContinue Boolean?                      // 是否愿意继续使用
  testQuestion  String?                       // 测试问题
  createdAt     DateTime @default(now())

  work     PublishedWork @relation(fields: [workId], references: [id])
  reviewer Participant   @relation(fields: [reviewerId], references: [id])
}
```

### 2.12 PublishedWork（发布作品）

```prisma
model PublishedWork {
  id            String   @id @default(uuid())
  projectId     String   @unique              // FK → AgentProject
  title         String
  visibility    String   @default("self")     // self|class_anonymous|allow_screen|public_link
  shareCode     String?  @unique              // 分享码
  screenedBy    String?                       // 审核教师
  screenedAt    DateTime?
  revokedAt     DateTime?                     // 撤回时间
  createdAt     DateTime @default(now())

  project  AgentProject   @relation(fields: [projectId], references: [id])
  feedbacks PeerFeedback[]
}
```

### 2.13 ConsentRecord（授权记录）

```prisma
model ConsentRecord {
  id            String   @id @default(uuid())
  participantId String                        // FK → Participant
  consentType   String                        // privacy|screen_display|work_publish
  granted       Boolean
  ipAddress     String?
  createdAt     DateTime @default(now())

  participant Participant @relation(fields: [participantId], references: [id])

  @@unique([participantId, consentType])
}
```

### 2.14 EnrollmentEvent（报名事件）

```prisma
model EnrollmentEvent {
  id            String   @id @default(uuid())
  participantId String                        // FK → Participant
  sessionId     String                        // FK → ClassSession
  eventType     String                        // page_view|form_submit|consult_click|contact_submit
  data          Json?                         // 提交数据（不含敏感信息明文）
  createdAt     DateTime @default(now())

  participant Participant  @relation(fields: [participantId], references: [id])
  session    ClassSession @relation(fields: [sessionId], references: [id])
}
```

### 2.15 AuditLog（审计日志）

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  sessionId String                        // FK → ClassSession
  actor     String                        // "teacher" | "system" | "student:{anonymousId}"
  action    String                        // 操作类型
  target    String?                       // 操作对象
  detail    Json?                         // 详情
  createdAt DateTime @default(now())

  session ClassSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId, createdAt])
}
```

## 三、配置 JSON 结构

### 3.1 AgentConfig（规则配置快照）

```typescript
interface AgentConfig {
  name: string;
  role: string;                      // 岗位
  targetAudience: string;            // 服务对象
  tasks: string[];                   // 主要任务
  sourcePolicy: 'only_source' | 'prefer_source' | 'allow_general';
  noAnswerPolicy: 'say_insufficient' | 'general_with_note' | 'ask_more';
  feedbackStyle: 'correct_only' | 'hint_then_full' | 'full_explanation';
  batchSize: 1 | 3 | 'flexible';
  additionalRules: string[];         // 自定义规则
}
```

### 3.2 WorkflowStep（工作流步骤）

```typescript
interface WorkflowStep {
  order: number;
  id: string;
  label: string;
  description: string;
  required: boolean;
}
```

### 3.3 EvaluationDimension（评估维度）

```typescript
interface EvaluationDimension {
  name: string;                      // 维度名
  score: number;                     // 1-5
  comment?: string;                  // 评语
  evidence?: string;                 // 证据引用
}
```

## 四、不可变约束

1. **配置版本化**：任何修改创建新版本，不覆盖旧版本
2. **运行绑定版本**：AIRun.configVersionId 不能为 null
3. **匿名优先**：Participant 不存储真实身份信息（除非学生自愿提交联系方式）
4. **审计完整性**：教师操作、模型切换、内容审核必须有 AuditLog
5. **数据可删除**：支持学生申请删除自己的全部数据
