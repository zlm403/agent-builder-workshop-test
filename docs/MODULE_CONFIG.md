# 课程模块配置规范 V1.0

## 一、核心设计原则

**所有课程内容由 JSON 配置驱动，不硬编码页面顺序。** 方案 B 将来只需重新组合模块，不应重建底层系统。

## 二、模块配置 Schema

```typescript
interface ModuleConfig {
  // 基本标识
  id: string;                         // 全局唯一，如 "A05_ADD_SOURCE"
  title: string;                      // 展示标题
  type: ModuleType;                   // 模块类型枚举

  // 教师端
  teacherContent: TeacherContent;     // 教师看到的内容和提示

  // 学生端
  studentTask: StudentTask;           // 学生任务定义

  // 大屏端
  screenMode: ScreenMode;             // 大屏展示模式
  screenContent?: ScreenContent;      // 大屏展示内容

  // 流程控制
  durationSeconds: number;            // 默认时长(秒)
  requiresAI: boolean;                // 是否需要 AI 调用
  entryCondition: string[];           // 前置模块 ID 列表
  completionRule: CompletionRule;     // 完成条件
  fallbackMode: FallbackMode;         // AI 失败时的降级策略
  nextModuleId: string;               // 默认下一个模块

  // 元数据
  tags?: string[];                    // 标签
  configurable?: boolean;             // 是否可由教师调整参数
}
```

## 三、模块类型详解

### 3.1 lecture — 讲解模块

```json
{
  "id": "A03_STRUCTURE",
  "type": "lecture",
  "teacherContent": {
    "notes": "依次揭示四个构件...",
    "script": "现在请大家思考...",
    "revealOrder": ["role", "source", "rules", "workflow"]
  },
  "screenContent": {
    "slides": [
      {
        "type": "reveal_list",
        "items": [
          { "icon": "badge", "title": "岗位", "subtitle": "它是谁，为谁工作，完成什么任务？" },
          { "icon": "folder", "title": "资料", "subtitle": "它依据什么信息工作？" },
          { "icon": "shield", "title": "规则", "subtitle": "它必须做什么，禁止做什么？" },
          { "icon": "workflow", "title": "流程", "subtitle": "它先做什么，再做什么？" }
        ]
      },
      {
        "type": "flow_chart",
        "nodes": ["任务输入", "读取资料", "根据规则判断", "执行流程", "输出结果", "接受测试"]
      }
    ]
  },
  "screenMode": "teacher_controlled",
  "durationSeconds": 600,
  "requiresAI": false,
  "completionRule": { "type": "auto", "trigger": "teacher_advance" }
}
```

### 3.2 single_choice / multi_choice — 投票模块

```json
{
  "id": "A01_BASELINE",
  "type": "single_choice",
  "teacherContent": {
    "notes": "了解学生 AI 使用水平，不做评判"
  },
  "studentTask": {
    "prompt": "你现在使用 AI，更像哪一种？",
    "options": [
      { "id": "a", "label": "我只是偶尔问问题", "value": "casual_user" },
      { "id": "b", "label": "我会连续追问和修改", "value": "iterative_user" },
      { "id": "c", "label": "我会写比较复杂的提示词", "value": "prompt_engineer" },
      { "id": "d", "label": "我做过固定工作流", "value": "workflow_user" },
      { "id": "e", "label": "我搭建过 Agent", "value": "agent_builder" }
    ]
  },
  "screenContent": {
    "type": "bar_chart",
    "showCount": true,
    "showPercentage": true
  },
  "screenMode": "progress",
  "durationSeconds": 300,
  "requiresAI": false,
  "completionRule": { "type": "submission", "count": 1 }
}
```

### 3.3 matching — 配对题

```json
{
  "id": "A03_STRUCTURE_QUIZ",
  "type": "matching",
  "studentTask": {
    "prompt": "将以下要求分类到正确的构件中",
    "items": [
      { "text": "服务准备期末考试的大一学生", "correctCategory": "role" },
      { "text": "只能依据上传的课堂笔记", "correctCategory": "rules" },
      { "text": "先出题，等学生回答后再批改", "correctCategory": "workflow" },
      { "text": "如果资料中没有答案，明确说明不知道", "correctCategory": "rules" }
    ],
    "categories": ["role", "source", "rules", "workflow"]
  },
  "completionRule": { "type": "accuracy", "threshold": 0.75 }
}
```

### 3.4 short_text — 短文本提交

```json
{
  "id": "A04_DEFINE_TASK",
  "type": "short_text",
  "studentTask": {
    "fields": [
      { "key": "target_audience", "label": "我希望它服务", "placeholder": "例如：正在备考的大学生", "required": true },
      { "key": "problem", "label": "我希望它解决", "placeholder": "例如：根据笔记出题并批改", "required": true },
      { "key": "biggest_issue", "label": "我最困扰的问题", "placeholder": "例如：每次都要手动整理知识点", "required": true }
    ],
    "aiAssist": {
      "skill": "normalize_goal",
      "prompt": "帮你把目标变得更具体"
    }
  },
  "completionRule": { "type": "all_fields_filled" }
}
```

### 3.5 agent_config — Agent 配置模块

```json
{
  "id": "A06_SET_RULES",
  "type": "agent_config",
  "studentTask": {
    "configSections": [
      {
        "key": "source_policy",
        "label": "回答依据",
        "type": "radio",
        "options": [
          { "value": "only_source", "label": "只能使用指定资料" },
          { "value": "prefer_source", "label": "优先使用指定资料" },
          { "value": "allow_general", "label": "可以使用通用知识" }
        ]
      },
      {
        "key": "no_answer_policy",
        "label": "资料里没有答案怎么办",
        "type": "radio",
        "options": [
          { "value": "say_insufficient", "label": "直接说明资料不足" },
          { "value": "general_with_note", "label": "给出一般解释，标注非资料内容" },
          { "value": "ask_more", "label": "追问或要求补充资料" }
        ]
      }
    ],
    "livePreview": {
      "type": "agent_card",
      "template": "{name} / 服务对象: {target_audience} / 依据: {source_policy}"
    }
  },
  "completionRule": { "type": "min_rules", "count": 4 }
}
```

### 3.6 workflow_order — 工作流排序

```json
{
  "id": "A07_CONFIG_WORKFLOW",
  "type": "workflow_order",
  "studentTask": {
    "availableSteps": [
      { "id": "read_source", "label": "读取资料", "icon": "folder" },
      { "id": "determine_kp", "label": "确定知识点", "icon": "target" },
      { "id": "confirm_difficulty", "label": "确认难度", "icon": "gauge" },
      { "id": "generate_question", "label": "生成问题", "icon": "edit" },
      { "id": "wait_answer", "label": "等待回答", "icon": "clock" },
      { "id": "evaluate", "label": "判断答案", "icon": "check" },
      { "id": "give_hint", "label": "给出提示", "icon": "lightbulb" },
      { "id": "explain", "label": "给出解析", "icon": "book" },
      { "id": "cite_source", "label": "引用依据", "icon": "link" },
      { "id": "record_error", "label": "记录错误", "icon": "clipboard" },
      { "id": "recommend_next", "label": "推荐下一步", "icon": "arrow_right" }
    ],
    "presetTemplates": [
      {
        "id": "basic",
        "name": "基础版",
        "steps": ["read_source", "determine_kp", "generate_question", "wait_answer", "evaluate", "explain"]
      },
      {
        "id": "coach",
        "name": "教练版",
        "steps": ["read_source", "determine_kp", "confirm_difficulty", "generate_question", "wait_answer", "evaluate", "give_hint", "explain", "cite_source", "record_error", "recommend_next"]
      },
      {
        "id": "challenge",
        "name": "挑战版",
        "steps": ["read_source", "confirm_difficulty", "generate_question", "wait_answer", "evaluate", "give_hint", "explain", "cite_source", "record_error", "recommend_next"]
      }
    ]
  },
  "completionRule": { "type": "valid_order", "minSteps": 4 }
}
```

### 3.7 ai_run — AI 运行模块

```json
{
  "id": "A08_FIRST_RUN",
  "type": "ai_run",
  "studentTask": {
    "skillName": "run_learning_agent",
    "configVersionRequired": 1,
    "showLiveStatus": true,
    "maxRetries": 2,
    "statusMessages": {
      "submitting": "正在提交任务",
      "processing": "正在处理资料",
      "generating": "正在生成结果",
      "retrying": "接口繁忙，正在重试",
      "fallback": "已切换至备用服务"
    }
  },
  "screenContent": {
    "type": "progress_overview",
    "showIndividual": false,
    "metrics": ["running", "completed", "avgDuration"]
  },
  "screenMode": "progress",
  "durationSeconds": 480,
  "requiresAI": true,
  "fallbackMode": "preset_demo"
}
```

### 3.8 diagnosis — 诊断模块

```json
{
  "id": "A10_DIAGNOSIS",
  "type": "diagnosis",
  "studentTask": {
    "ratingDimensions": [
      { "key": "source_adherence", "label": "是否依据资料" },
      { "key": "workflow_adherence", "label": "是否遵守流程" },
      { "key": "format_adherence", "label": "是否符合格式" },
      { "key": "difficulty_match", "label": "难度是否合适" },
      { "key": "explanation_helpful", "label": "解释是否有帮助" }
    ],
    "issueChecklist": [
      "编造了资料外内容",
      "没等我回答",
      "没有提供资料依据",
      "反馈太长",
      "反馈太短",
      "难度不合适",
      "没有记录错误",
      "其他"
    ],
    "autoSuggest": {
      "skill": "suggest_revision",
      "presentAs": "editable_suggestions"
    }
  },
  "completionRule": { "type": "all_dimensions_rated", "and": "min_one_issue_flagged" }
}
```

### 3.9 compare_runs — 前后对比模块

```json
{
  "id": "A14_COMPARE",
  "type": "compare_runs",
  "studentTask": {
    "run1ConfigVersion": 1,
    "run2ConfigVersion": 2,
    "compareSkill": "compare_runs",
    "showRawImprovement": true,
    "allowUnresolvedDisplay": true
  },
  "screenContent": {
    "type": "side_by_side",
    "leftLabel": "第一次运行",
    "rightLabel": "第二次运行"
  },
  "screenMode": "teacher_controlled",
  "durationSeconds": 300,
  "requiresAI": true,
  "fallbackMode": "show_raw_data"
}
```

## 四、方案 A 完整模块配置

```json
{
  "version": "A",
  "name": "我的第一个 AI Agent",
  "subtitle": "从任务、资料和规则开始，完成一次真实的搭建、测试与升级",
  "modules": [
    { "id": "A00_WAITING", "type": "waiting", "title": "课堂等待", "durationSeconds": 300 },
    { "id": "A01_BASELINE", "type": "single_choice", "title": "你真的会使用 AI 吗", "durationSeconds": 300 },
    { "id": "A02_CHALLENGE", "type": "multi_choice", "title": "普通 AI 能不能完成任务", "durationSeconds": 600 },
    { "id": "A03_STRUCTURE", "type": "lecture", "title": "什么是 Agent", "durationSeconds": 600 },
    { "id": "A04_DEFINE_TASK", "type": "short_text", "title": "选择你的任务", "durationSeconds": 600 },
    { "id": "A05_ADD_SOURCE", "type": "source_select", "title": "给 Agent 一份资料", "durationSeconds": 600 },
    { "id": "A06_SET_RULES", "type": "agent_config", "title": "设置工作边界", "durationSeconds": 600 },
    { "id": "A07_CONFIG_WORKFLOW", "type": "workflow_order", "title": "设计工作流程", "durationSeconds": 600 },
    { "id": "A08_FIRST_RUN", "type": "ai_run", "title": "第一次运行", "durationSeconds": 480 },
    { "id": "A09_STRESS_TEST", "type": "ai_run", "title": "压力测试", "durationSeconds": 600 },
    { "id": "A10_DIAGNOSIS", "type": "diagnosis", "title": "给 Agent 做诊断", "durationSeconds": 600 },
    { "id": "A11_SECOND_RUN", "type": "ai_run", "title": "二次运行", "durationSeconds": 420 },
    { "id": "A12_COMPARE", "type": "compare_runs", "title": "前后对比", "durationSeconds": 300 },
    { "id": "A13_PUBLISH", "type": "publish", "title": "作品发布", "durationSeconds": 480 },
    { "id": "A14_PEER_REVIEW", "type": "peer_review", "title": "同伴互测", "durationSeconds": 480 },
    { "id": "A15_REVIEW", "type": "lecture", "title": "集体复盘", "durationSeconds": 300 },
    { "id": "A16_COURSE_PATH", "type": "course_path", "title": "正式课路径", "durationSeconds": 420 },
    { "id": "A17_ENROLLMENT", "type": "enrollment", "title": "报名与答疑", "durationSeconds": 420 }
  ]
}
```

## 五、方案 B 预留配置骨架

```json
{
  "version": "B",
  "name": "AI Agent 如何改变你的学习与职业",
  "subtitle": "体验三个真实场景，找到最适合自己的 Agent 项目方向",
  "modules": [
    { "id": "B00_WAITING", "type": "waiting", "title": "课堂等待", "implementationStatus": "shared_base" },
    { "id": "B01_NEED_SELECT", "type": "multi_choice", "title": "你最希望 AI 帮你做什么", "implementationStatus": "shared_base" },
    { "id": "B02_VALUE_JUDGE", "type": "true_false", "title": "AI 价值判断", "implementationStatus": "shared_base" },
    { "id": "B03_TASK_MAP", "type": "multi_choice", "title": "任务地图", "implementationStatus": "shared_base" },
    { "id": "B04_CASE_LEARN_1", "type": "source_select", "title": "学习案例-选择", "implementationStatus": "reserved" },
    { "id": "B05_CASE_LEARN_2", "type": "multi_choice", "title": "学习案例-判断", "implementationStatus": "reserved" },
    { "id": "B06_CASE_LEARN_3", "type": "ai_run", "title": "学习案例-AI 执行", "implementationStatus": "reserved" },
    { "id": "B07_CASE_LEARN_4", "type": "diagnosis", "title": "学习案例-复盘", "implementationStatus": "reserved" },
    { "id": "B08_CASE_JOB_1", "type": "single_choice", "title": "求职案例-选岗", "implementationStatus": "reserved" },
    { "id": "B09_CASE_JOB_2", "type": "matching", "title": "求职案例-分析", "implementationStatus": "reserved" },
    { "id": "B10_CASE_JOB_3", "type": "ai_run", "title": "求职案例-AI 分析", "implementationStatus": "reserved" },
    { "id": "B11_CASE_JOB_4", "type": "diagnosis", "title": "求职案例-复盘", "implementationStatus": "reserved" },
    { "id": "B12_CASE_PROJ_1", "type": "single_choice", "title": "项目案例-选择", "implementationStatus": "reserved" },
    { "id": "B13_CASE_PROJ_2", "type": "multi_choice", "title": "项目案例-定义对象", "implementationStatus": "reserved" },
    { "id": "B14_CASE_PROJ_3", "type": "ai_run", "title": "项目案例-AI 方案", "implementationStatus": "reserved" },
    { "id": "B15_CASE_PROJ_4", "type": "diagnosis", "title": "项目案例-批评修改", "implementationStatus": "reserved" },
    { "id": "B16_STRUCTURE_SUMMARY", "type": "lecture", "title": "三个案例的共同结构", "implementationStatus": "reserved" },
    { "id": "B17_SELF_DIAGNOSE", "type": "short_text", "title": "我的任务诊断", "implementationStatus": "reserved" },
    { "id": "B18_OPPORTUNITY_MAP", "type": "ai_run", "title": "生成 Agent 机会地图", "implementationStatus": "reserved" },
    { "id": "B19_DIRECTION_CHOOSE", "type": "single_choice", "title": "选择一个方向", "implementationStatus": "reserved" },
    { "id": "B20_FIRST_ACTION", "type": "multi_choice", "title": "你的第一步行动", "implementationStatus": "reserved" },
    { "id": "B21_COURSE_PATH", "type": "course_path", "title": "正式课如何把方向变成作品", "implementationStatus": "reserved" },
    { "id": "B22_ENROLLMENT", "type": "enrollment", "title": "报名与答疑", "implementationStatus": "shared_base" }
  ]
}
```

## 六、页面类型枚举 (ScreenMode)

```typescript
type ScreenMode =
  | 'teacher_controlled'  // 教师手动控制大屏显示
  | 'progress'            // 实时进度展示
  | 'question'            // 问题展示
  | 'comparison'          // 左右对比
  | 'interaction'         // 互动结果展示
  | 'live_data'           // 实时数据（柱状图/词云等）
  | 'live_operation'      // 现场操作展示
  | 'summary'             // 总结页
  | 'result_wall'         // 作品墙
```

## 七、配置扩展性

未来可通过修改 `CourseTemplate.modules` JSON 实现：
- 调整模块顺序
- 替换案例内容
- 改变时间限制
- 增加/删除选项
- 制作其他专业版本（如医学、法律、金融专用版）
- 生成版本 C（融合版）

**不需要修改核心代码。**
