# API 接口规范 V1.0

## 一、接口设计原则

1. RESTful 风格，JSON 请求/响应
2. 学生端使用匿名 token 认证（resumeToken）
3. 教师端和管理端使用 JWT
4. 实时推送使用 WebSocket
5. 所有 AI 调用经后端代理，不暴露模型密钥

## 二、认证机制

### 学生认证
```
Header: X-Student-Token: <resumeToken>
```
- 入场时分配，用于断线恢复
- 与 anonymousId 关联，不关联真实身份

### 教师/管理认证
```
Header: Authorization: Bearer <jwt_token>
```

## 三、API 端点清单

### 3.1 课堂管理 `/api/classroom`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/classroom` | 创建课堂 | teacher |
| GET | `/api/classroom/:id` | 获取课堂详情 | teacher |
| PATCH | `/api/classroom/:id` | 更新课堂状态 | teacher |
| POST | `/api/classroom/:id/start` | 开始课堂 | teacher |
| POST | `/api/classroom/:id/pause` | 暂停课堂 | teacher |
| POST | `/api/classroom/:id/resume` | 恢复课堂 | teacher |
| POST | `/api/classroom/:id/end` | 结束课堂 | teacher |
| GET | `/api/classroom/:id/qrcode` | 获取入场二维码 | teacher |
| GET | `/api/classroom/:id/stats` | 获取课堂统计 | teacher |
| GET | `/api/classroom/join/:inviteCode` | 通过邀请码获取课堂信息 | public |

**创建课堂请求：**
```json
{
  "templateId": "uuid-of-course-template",
  "teacherId": "teacher-001"
}
```

**创建课堂响应：**
```json
{
  "id": "session-uuid",
  "inviteCode": "A7K3X2",
  "qrcodeUrl": "https://...",
  "status": "pending"
}
```

### 3.2 学生入场 `/api/student`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/student/join` | 学生加入课堂 | public |
| GET | `/api/student/:anonymousId/profile` | 获取学生信息 | student |
| PATCH | `/api/student/:anonymousId/nickname` | 修改昵称 | student |
| POST | `/api/student/resume` | 断线恢复 | public |
| POST | `/api/student/consent` | 提交授权 | student |

**加入课堂请求：**
```json
{
  "inviteCode": "A7K3X2",
  "nickname": "小明",
  "deviceInfo": { "os": "iOS", "browser": "Safari" }
}
```

**加入课堂响应：**
```json
{
  "anonymousId": "A023",
  "resumeToken": "rt_xxxx",
  "sessionId": "session-uuid",
  "consentRequired": ["privacy", "screen_display"]
}
```

### 3.3 模块引擎 `/api/module`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/module/advance` | 教师推进到下一模块 | teacher |
| POST | `/api/module/jump` | 教师跳转到指定模块 | teacher |
| POST | `/api/module/lock` | 锁定/解锁当前模块 | teacher |
| GET | `/api/module/current` | 获取当前模块配置 | student/teacher |
| POST | `/api/module/submit` | 学生提交模块任务 | student |
| GET | `/api/module/:moduleId/progress` | 查看全班模块进度 | teacher |

**推进模块请求：**
```json
{
  "sessionId": "session-uuid",
  "targetModuleId": "A05_ADD_SOURCE"
}
```

**学生提交响应：**
```json
{
  "participantId": "...",
  "moduleId": "A05_ADD_SOURCE",
  "status": "submitted",
  "nextActions": ["wait_for_teacher"]
}
```

### 3.4 进度追踪 `/api/progress`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/progress/session/:sessionId/summary` | 全班进度汇总 | teacher |
| GET | `/api/progress/session/:sessionId/:moduleId` | 某模块详细进度 | teacher |
| GET | `/api/progress/student/:anonymousId` | 某学生全部进度 | student/teacher |
| GET | `/api/progress/session/:sessionId/stuck` | 卡住学生列表 | teacher |

**全班进度汇总响应：**
```json
{
  "currentModule": "A06_SET_RULES",
  "totalStudents": 46,
  "overview": [
    { "moduleId": "A05_ADD_SOURCE", "completed": 41, "inProgress": 4, "stuck": 1, "notStarted": 0 }
  ],
  "helpRequests": 2,
  "avgCompletion": "2m14s"
}
```

### 3.5 AI 调用代理 `/api/ai`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/ai/run/:skillName` | 执行指定 Skill | student |
| GET | `/api/ai/status/:runId` | 查询运行状态 | student |
| POST | `/api/ai/cancel/:runId` | 取消运行 | teacher |
| GET | `/api/ai/session/:sessionId/stats` | 全班 AI 调用统计 | teacher |
| POST | `/api/ai/model/switch` | 切换模型 | teacher |
| POST | `/api/ai/demo-mode` | 开启/关闭演示模式 | teacher |

**执行 Skill 请求：**
```json
{
  "skillName": "run_learning_agent",
  "projectId": "project-uuid",
  "configVersionId": "config-v1-uuid",
  "params": {
    "userMessage": "根据资料给我出一道中等难度的题"
  }
}
```

**执行 Skill 响应：**
```json
{
  "runId": "run-uuid",
  "status": "completed",
  "output": { "question": "...", "answer": "..." },
  "durationMs": 5400,
  "modelUsed": "gpt-4o",
  "schemaValid": true,
  "factCheckPass": true
}
```

### 3.6 作品管理 `/api/project`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/project` | 创建 Agent 项目 | student |
| GET | `/api/project/:id` | 获取项目详情 | student/teacher |
| PATCH | `/api/project/:id/config` | 更新配置（创建新版本） | student |
| POST | `/api/project/:id/source` | 添加资料 | student |
| GET | `/api/project/:id/source` | 获取资料 | student/teacher |
| POST | `/api/project/:id/workflow` | 创建工作流 | student |

### 3.7 发布与互测 `/api/publish`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/publish` | 发布作品 | student |
| PATCH | `/api/publish/:id/visibility` | 修改可见范围 | student/teacher |
| POST | `/api/publish/:id/revoke` | 教师撤回作品 | teacher |
| GET | `/api/publish/:id` | 获取发布详情 | student/teacher |
| POST | `/api/publish/:id/feedback` | 提交互测反馈 | student |
| GET | `/api/publish/pair-for-review` | 获取互测配对 | student |
| GET | `/api/publish/session/:sessionId/list` | 全班作品列表 | teacher |

### 3.8 投屏管理 `/api/screen`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/screen/display` | 教师选择投屏内容 | teacher |
| GET | `/api/screen/current/:sessionId` | 获取当前投屏内容 | screen |
| DELETE | `/api/screen/display` | 取消投屏 | teacher |

### 3.9 数据导出 `/api/export`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/export/session/:sessionId/summary` | 导出课堂总结 | teacher/admin |
| GET | `/api/export/session/:sessionId/detail` | 导出详细数据 (CSV) | admin |
| GET | `/api/export/session/:sessionId/ai-logs` | 导出 AI 调用日志 | admin |
| POST | `/api/export/student/:anonymousId/delete` | 学生数据删除请求 | student |

### 3.10 管理端 `/api/admin`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/admin/templates` | 课程模板列表 | admin |
| POST | `/api/admin/templates` | 创建/更新模板 | admin |
| GET | `/api/admin/knowledge` | 知识库列表 | admin |
| POST | `/api/admin/knowledge` | 管理知识库 | admin |
| GET | `/api/admin/models` | 模型配置 | admin |
| PATCH | `/api/admin/models` | 更新模型配置 | admin |
| GET | `/api/admin/moderation/rules` | 审核规则 | admin |

## 四、WebSocket 事件

### 连接地址
```
ws(s)://<host>/ws?token=<resumeToken|jwt>&role=<student|teacher|screen>
```

### 事件列表

| 事件 | 方向 | 说明 | 接收方 |
|---|---|---|---|
| `module:advanced` | server→client | 教师推进模块 | student, screen |
| `module:locked` | server→client | 模块锁定/解锁 | student |
| `progress:update` | server→client | 进度更新 | teacher |
| `student:joined` | server→client | 新学生加入 | teacher, screen |
| `student:stuck` | server→client | 学生请求帮助 | teacher |
| `screen:update` | server→client | 投屏内容变更 | screen |
| `ai:status` | server→client | AI 运行状态更新 | student, teacher |
| `timer:sync` | server→client | 倒计时同步 | student, screen |
| `timer:extend` | client→server | 教师延长倒计时 | teacher |
| `classroom:ended` | server→client | 课堂结束 | all |

## 五、错误响应格式

```json
{
  "error": {
    "code": "AI_TIMEOUT",
    "message": "AI 任务超时，正在重试...",
    "retryable": true,
    "retryCount": 1,
    "maxRetries": 3
  }
}
```

### 常见错误码

| 错误码 | 说明 |
|---|---|
| `INVALID_TOKEN` | 认证令牌无效 |
| `SESSION_NOT_ACTIVE` | 课堂未开始或已结束 |
| `MODULE_NOT_ACTIVE` | 当前模块不可操作 |
| `MODULE_LOCKED` | 模块已被教师锁定 |
| `AI_TIMEOUT` | AI 调用超时 |
| `AI_RATE_LIMITED` | 达到调用频率限制 |
| `AI_FALLBACK` | 已切换备用模型 |
| `AI_DEMO_MODE` | 当前处于演示模式 |
| `CONTENT_BLOCKED` | 内容未通过审核 |
| `CONSENT_REQUIRED` | 需要先完成授权 |

## 六、限流规则

| 端点 | 限制 | 窗口 |
|---|---|---|
| `/api/student/join` | 100 次/秒 | 1s |
| `/api/ai/run/*` | 每学生 10 次/课堂 | 课堂周期 |
| `/api/ai/run/*` | 全班并发 20 | 实时 |
| `/api/module/submit` | 每学生 30 次/分钟 | 1min |
| 全局 | 1000 次/秒 | 1s |
