# 技术架构文档 V1.0

## 一、整体架构图

```text
┌─────────────────────────────────────────────────────────┐
│                      客户端层                            │
├──────────────┬──────────────┬──────────────┬────────────┤
│ 教师导演台    │  课堂大屏     │  学生移动端   │ 运营管理端  │
│ (Next.js)    │ (Next.js)    │ (Next.js)    │ (Next.js)  │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                            │
              ┌─────────────┴─────────────┐
              │      API Gateway          │
              │   (Next.js API Routes     │
              │    或 FastAPI)             │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 课堂流程服务   │  │ AI 编排服务   │  │ 内容审核服务  │
│ - 模块引擎    │  │ - 模型适配层  │  │ - 敏感词过滤  │
│ - 进度追踪    │  │ - Schema校验  │  │ - 输出检查    │
│ - 教师控制    │  │ - 重试/降级   │  │ - 昵称审核    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│PostgreSQL│  │   Redis      │  │  对象存储     │
│/Supabase │  │ - 会话缓存   │  │ (S3兼容)     │
│          │  │ - 限流计数   │  │ - 资料文件    │
│          │  │ - 实时状态   │  │ - 作品资源    │
└──────────┘  └──────────────┘  └──────────────┘
```

## 二、技术栈

| 层面 | 选型 | 理由 |
|---|---|---|
| 前端框架 | Next.js 14+ / React | 服务端渲染 + API Routes 统一 |
| 后端 | Next.js API Routes 或 FastAPI | 如 AI 调用复杂，FastAPI 更灵活 |
| 数据库 | PostgreSQL (Supabase 托管) | 结构化管理课堂/进度/配置 |
| 实时同步 | WebSocket 或 Supabase Realtime | 教师端实时进度更新 |
| 缓存 | Redis | 会话、限流、实时状态 |
| 文件存储 | S3 兼容 (MinIO/Cloudflare R2) | 资料文件、作品资源 |
| AI 接口 | 统一模型适配层 | 至少主、备两个模型 |
| 部署 | 优先中国大陆可达环境 | 课堂网络稳定性 |

## 三、目录结构

```
agent-trial-classroom/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (teacher)/          # 教师导演台路由
│   │   ├── (screen)/           # 课堂大屏路由
│   │   ├── (student)/          # 学生端路由
│   │   ├── (admin)/            # 运营管理端路由
│   │   └── api/                # API Routes
│   │       ├── classroom/      # 课堂管理
│   │       ├── module/         # 模块引擎
│   │       ├── ai/             # AI 调用代理
│   │       ├── progress/       # 进度追踪
│   │       ├── publish/        # 作品发布
│   │       └── export/         # 数据导出
│   ├── components/             # 共享 UI 组件
│   │   ├── ui/                 # 基础 UI 组件
│   │   ├── classroom/          # 课堂组件
│   │   ├── student/            # 学生交互组件
│   │   └── screen/             # 大屏展示组件
│   ├── lib/                    # 核心库
│   │   ├── db/                 # 数据库层
│   │   ├── ai/                 # AI 编排
│   │   ├── skills/             # Skills 实现
│   │   ├── knowledge/          # 知识库
│   │   ├── auth/               # 匿名认证
│   │   └── validation/         # 校验层
│   ├── config/                 # 配置文件
│   │   ├── courses/            # 课程版本配置
│   │   ├── modules/            # 模块类型定义
│   │   └── models/             # 模型配置
│   └── types/                  # TypeScript 类型
├── prisma/                     # 数据库 Schema
├── public/                     # 静态资源
├── tests/                      # 测试
│   ├── unit/                   # 单元测试
│   ├── integration/            # 集成测试
│   └── e2e/                    # 端到端测试
└── docs/                       # 文档
```

## 四、共用底座设计原则

### 4.1 课程配置驱动

所有课程内容由 JSON 配置驱动，不硬编码页面顺序：

```typescript
// 核心配置类型
interface CourseVersion {
  id: string;                    // "A" | "B"
  name: string;
  subtitle: string;
  modules: ModuleConfig[];
  defaultDuration: number;       // 秒
}

interface ModuleConfig {
  id: string;                    // "A05_ADD_SOURCE"
  title: string;
  type: ModuleType;              // 模块类型枚举
  teacherContent: TeacherContent;
  studentTask: StudentTask;
  screenMode: ScreenMode;
  durationSeconds: number;
  requiresAI: boolean;
  entryCondition: string[];
  completionRule: CompletionRule;
  fallbackMode: FallbackMode;
  nextModuleId: string;
}
```

### 4.2 模块类型枚举

方案 A 与 B 共用以下模块类型：

```typescript
type ModuleType =
  | 'lecture'           // 讲解模块
  | 'single_choice'     // 单选投票
  | 'multi_choice'      // 多选投票
  | 'true_false'        // 判断题
  | 'matching'          // 配对题
  | 'short_text'        // 短文本提交
  | 'source_select'     // 资料选择/粘贴
  | 'agent_config'      // Agent 配置
  | 'workflow_order'    // 工作流排序
  | 'ai_run'            // AI 运行
  | 'result_scoring'    // 结果评分
  | 'diagnosis'         // 故障诊断
  | 'compare_runs'      // 前后对比
  | 'publish'           // 作品发布
  | 'peer_review'       // 互测
  | 'course_path'       // 课程路径
  | 'enrollment'        // 报名反馈
  | 'waiting'           // 等待页
```

### 4.3 共用基础设施

| 组件 | A 版使用 | B 版保留 |
|---|---|---|
| 课堂创建 + 二维码入场 | ✅ | ✅ |
| 模块引擎 + 进度追踪 | ✅ | ✅ |
| 教师导演台框架 | ✅ | ✅ |
| 大屏展示框架 | ✅ | ✅ |
| 学生端框架 | ✅ | ✅ |
| 实时同步 (WebSocket) | ✅ | ✅ |
| AI 调用代理 | ✅ | ✅ |
| 内容审核 | ✅ | ✅ |
| 数据持久化 | ✅ | ✅ |
| 单选/多选/判断/配对 | ✅ | ✅ |
| 短文本提交 | ✅ | ✅ |
| 资料处理 | ✅ | ✅ |
| Agent 配置 | ✅ | 预留接口 |
| 工作流排序 | ✅ | 预留接口 |
| AI 运行 + 诊断 | ✅ | 预留接口 |
| 前后对比 | ✅ | 预留接口 |
| 作品发布 + 互测 | ✅ | 预留接口 |
| 案例体验 (B 专属) | — | 预留接口 |
| 机会地图 (B 专属) | — | 预留接口 |

## 五、部署架构

```text
                    ┌──────────────┐
                    │   CDN/Nginx  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Next.js App  │
                    │ (Vercel/     │
                    │  自有服务器)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │ PostgreSQL │ │ Redis │ │ S3 Storage │
        └───────────┘ └───────┘ └───────────┘
```

部署要求：
- 优先选择中国大陆课堂网络可稳定访问的环境
- 建议使用国内云服务商 (如腾讯云) 或香港节点
- WebSocket 需支持代理穿透
