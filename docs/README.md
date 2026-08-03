# AI Agent 互动试听课系统 — 开发文档索引

## 项目代号：`agent-trial-classroom`

## 文档清单

| 编号 | 文档 | 说明 | 读者 |
|---|---|---|---|
| 1 | [PROJECT_SPEC.md](./PROJECT_SPEC.md) | **项目总览与目标** — 系统定位、边界、四端定义、方案A流程 | 全员 |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | **技术架构** — 系统架构图、技术栈、目录结构、共用底座设计 | 开发 |
| 3 | [DATA_MODELS.md](./DATA_MODELS.md) | **数据模型** — 全部 15 个实体定义、Prisma Schema、不可变约束 | 后端开发 |
| 4 | [MODULE_CONFIG.md](./MODULE_CONFIG.md) | **模块配置规范** — 配置驱动设计、9 种模块类型详解、方案 A/B 配置 | 前后端开发 |
| 5 | [SKILLS_SPEC.md](./SKILLS_SPEC.md) | **Skills 规格** — 14 个 Skill 定义、输入输出 Schema、容灾流程 | AI/后端开发 |
| 6 | [API_SPEC.md](./API_SPEC.md) | **API 接口规范** — 10 组端点、WebSocket 事件、错误码、限流规则 | 前后端开发 |
| 7 | [SPRINT_PLAN.md](./SPRINT_PLAN.md) | **Sprint 开发计划** — 5 个 Sprint 详细任务清单、并行任务、风险 | PM/开发 |
| 8 | [ACCEPTANCE.md](./ACCEPTANCE.md) | **验收标准** — 功能、AI 质量、设备、课堂指标、隐私、安全 | QA/全员 |

## 开发优先级

```
Sprint 1: 共用课堂底座
  └─ 课堂创建 → 二维码入场 → 模块引擎 → 进度追踪
  └─ 此基础上 A、B 两方案可并行开发

Sprint 2: 方案A核心闭环
  └─ 14个Skills → 11个互动模块 → AI编排服务

Sprint 3: 作品与控制
  └─ 发布 → 互测 → 投屏 → 审核 → 导出

Sprint 4-5: 测试与上线
```

## 关键设计决策

1. **配置驱动**：所有课程内容由 JSON 配置，不硬编码页面顺序
2. **方案 B 接口预留**：方案 B 只需重新组合模块，不重建底层系统
3. **版本不可覆盖**：AgentConfig 修改创建新版本，不覆盖旧版
4. **五步容灾**：格式修复 → 重试 → 切换模型 → 错误返回 → 演示模式
5. **Skill ≠ Prompt**：每个 Skill 有明确输入/输出/校验/失败处理
6. **一次扫码、全程跟随**：不依赖反复扫码

## 快速导航

- 如果你是新加入的**后端开发**：先读 PROJECT_SPEC → ARCHITECTURE → DATA_MODELS → API_SPEC
- 如果你是新加入的**前端开发**：先读 PROJECT_SPEC → ARCHITECTURE → MODULE_CONFIG → API_SPEC
- 如果你是新加入的**AI/算法**：先读 PROJECT_SPEC → SKILLS_SPEC → ACCEPTANCE（AI质量部分）
- 如果你是**PM/测试**：先读 PROJECT_SPEC → SPRINT_PLAN → ACCEPTANCE
