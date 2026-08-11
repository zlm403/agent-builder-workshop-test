# AR 教学监控系统 · 学生端 Demo

老大，这是「项目一 · 让 AI 听懂你的想法」课堂系统的学生端 + 老师监控端。

## 目录结构

```
ar-class-monitor-demo/
├── server.py             数据服务（P1）：静态文件 + POST /api/collect + GET /api/events + GET /api/class
├── start_server.ps1      一键启动服务（后台常驻）
├── lib/track.js          预埋上报模块（学员作品模板通用，自动带 sid + course + POST 上报）
├── lib/analyze.js        理解棱镜穿透算法（一核多表：语言/边界/规则/系统四套维度表，三端共用）
├── agent-live/           事件数据（events.jsonl 统一落盘 + 对话记录.md）
├── student/              学生端 · 4 课通用课堂工作台（任务看板 / 引导 / 作品容器 / 我的理解棱镜）
├── warmup/               预备课作品 · 表达梳理台（表达→AI 梳理→确认修正，含埋点）
├── game/                 第一课作品 · 答疑闯关游戏（资料与边界，含埋点）
├── tool/                 第二课作品 · 校园活动方案生成器（流程与规则，含埋点）
├── agent-team/           下午综合课作品 · 多员工应用工坊（拆能力/配员工/选工具/交接/测试发布，含埋点）
├── bigscreen/            大屏端 · 匿名班级隐形壳（班级棱镜自动轮播 + 匿名学生墙，只读）
├── monitor/              老师监控看板（按课/学员切换 + 班级理解棱镜热力 + 对话/作品数据 + 穿透分析）
├── seed_demo.py          演示数据重灌（保留对话记录 + 三人对比学生事件）
├── docs/                 4 课顷悟应用平台配置 / 演示脚本 / 整课系统流程说明
├── project1/             学生端·旧版（三标签页，保留参考）
├── plan-a/               方案A（对比用）· 顷悟 AI 应用
├── plan-b/               方案B（对比用）· 自写前端
└── README.md
```

## 怎么跑（本地测试）

所有页面必须**同源**（都走 http），监控端才能读到学生事件。推荐用自带的数据服务：

```bash
cd 到 ar-class-monitor-demo 目录
powershell -ExecutionPolicy Bypass -File start_server.ps1 8099
```

（等价于旧 `python -m http.server`，但额外提供数据 API；后台常驻，关闭终端不影响。）

然后浏览器开：

| 页面 | 地址 |
|---|---|
| 学生端·课堂工作台（4 课通用，推荐） | `http://localhost:8099/student/` |
| 预备课作品 · 表达梳理台 | `http://localhost:8099/warmup/` |
| 第一课作品 · 答疑闯关游戏 | `http://localhost:8099/game/` |
| 第二课作品 · 校园活动方案生成器 | `http://localhost:8099/tool/` |
| 下午综合课作品 · 多员工应用工坊 | `http://localhost:8099/agent-team/` |
| 老师监控看板 | `http://localhost:8099/monitor/` |
| 大屏端 · 匿名班级隐形壳 | `http://localhost:8099/bigscreen/` |
| 4 课应用平台配置文档 | `http://localhost:8099/docs/4-apps-config.md` |
| 演示脚本 + 验收清单 | `http://localhost:8099/docs/demo-script.md` |
| 整课系统流程说明 | `http://localhost:8099/docs/system-flow.md` |
| 学生端·项目一（旧三标签页，保留参考） | `http://localhost:8099/project1/` |
| 方案A（对比用） | `http://localhost:8099/plan-a/` |
| 方案B（对比用） | `http://localhost:8099/plan-b/` |
| API：读全部事件 | `http://localhost:8099/api/events?since=0` |
| API：班级聚合（学生状态 + 每课事件轨迹） | `http://localhost:8099/api/class` |

## 学生端「课堂工作台」（P2 重构）

`student/` 是 4 课通用的学生端壳：课程切换（预备课/第一课/第二课/综合课）+ 任务看板（按课接收老师推送）+ 本课引导 + 作品运行容器（iframe，P3 填充）。

**不嵌顷悟对话通道**：学员与 AI 的对话在顷悟 APP 内完成（每课一个顷悟应用，对话数据由平台侧自动记录上报）；本页只负责任务、引导、作品运行与作品数据埋点。

## 数据服务 API（P1 数据基座）

`server.py` 提供静态文件 + 数据 API，事件统一落 `agent-live/events.jsonl`（与对话记录 skill 同一数据源）：

| API | 说明 | 示例 |
|---|---|---|
| `POST /api/collect` | 接收事件（单对象或数组），追加落盘；自动从 page 归一化 course | body: `{"ts":..., "sid":"stu1", "event":"game_start", "payload":{...}}` |
| `GET /api/events` | 返回事件数组；`?since=ts` 增量拉取；`?sid=` 按学员过滤 | `GET /api/events?since=1700000000000&sid=stu1` |
| `GET /api/class` | 班级聚合：`students`（每人最近文本）+ `byTask`（每课×每学生事件轨迹）+ `taskTurn`；棱镜判定由前端 `lib/analyze.js` 跑 | `GET /api/class` |
| `OPTIONS` | CORS 预检（已全开，学员作品跨域上报可用） | — |

> 坏数据自动 400 拒绝；读取跳过坏行，服务不会因脏数据挂掉。

## 理解棱镜穿透（一核多表）

`lib/analyze.js` 是"学生以为做到了 / 实际缺了什么"的显影算法，三端（学生镜子 / 教师热力 / 大屏投影）共用同一份：

- **核**：把学生在一门课里留下的作品事件轨迹拆成固定维度格子 → 标六色状态（✅已确认 / 📋已识别 / 🟡推测 / △待澄清 / ⬜空缺 / 🔴冲突）→ 找缺口
- **表**：每课穿各自的维度表，绝不统一套一套格子：

| 课 | 棱镜 | 穿什么 |
|---|---|---|
| 预备课 | 语言棱镜（10 格，文本） | 对象/场景/问题/任务/目标/标准/范围/互动/限制/输出 —— 想法说清楚没 |
| 第一课 | 边界棱镜（5 格，事件） | 资料整理/有依据回答/边界测试/测试深度/边界外处理 —— 依据在不在资料内 |
| 第二课 | 规则棱镜（6 格，事件） | 输入收集/信息检查/步骤拆解/规则约束/规范输出/异常测试 —— 流程规则立没立 |
| 综合课 | 系统棱镜（5 格，事件） | 目标拆解/员工分工/工具选型/交接设计/测试发布 —— 能力系统成没成 |

演示数据重灌：`python seed_demo.py`（保留对话记录，重建三人对比学生事件）。

## 可预埋 track() 上报模块（学员作品模板通用）

`lib/track.js` 供学员作品（游戏 / 工具 / 应用）一行接入上报：

```html
<script src="lib/track.js"></script>
<script>
  Track.config({ endpoint: '/api/collect' });   // 默认同源，部署时可指向监控服务器
  Track.event('game_start', { level: 1 });      // 任意自定义事件
</script>
```

- sid 自动带：`?sid=` URL 参数 → localStorage → 随机匿名
- 跨域自动处理；同源时同时写 localStorage（兼容看板 demo 直读）
- 失败静默，不打断学生操作；页面加载自动上报 `page_loaded`

## 课堂演示流程

1. 老师打开监控看板 → 推送课堂任务（任务编号/标题/说明/目标/步骤）
2. 学生打开 `project1/` → 填学号 → 「项目看板」标签自动出现老师推送的任务 → 点「收到」
3. 学生到「执行面板」：
   - **🖥 网页执行**：引导四步（写想法 → AI 翻译 → 补空缺 → 回读）
   - **🤖 顷悟 Agent 执行**：自由对话（演示环境模拟 Agent 对话框自动同步）
4. 学生到「数据穿透」标签：看"你以为说的 vs AI 听到的"对比 + AI 复盘点评
5. 老师看板实时显示每位学生的网页操作 + Agent 对话 + 穿透分析

## 数据链路（两路数据都到监控）

| 来源 | 事件 | 通道 |
|---|---|---|
| 网页执行 | `idea_submit` / `ai_chat_req` / `ai_chat_resp` / `fields_filled` / `readback_confirm` / `finish` / `step` … | localStorage(同源) + POST `/api/collect` |
| 顷悟 Agent | `agent_dialog_req` / `agent_dialog_resp` | 演示环境：网页内模拟；真实环境：顷悟项目埋 skill 自动上报 |
| 老师任务 | `task_push` / `task_view` | 老师端写独立任务槽 `ar_class_monitor_task`，学生端轮询秒读 |

> **真实环境对接**：顷悟 Agent 对话框里的对话，需要顷悟平台侧把对话记录同步出来（项目内埋 skill 或平台 API），推送到 `/api/collect`。本 demo 用网页内模拟通道演示同一数据链路。

### 新增：喵小悟 → Agent 看板 本地日志链路（已验证）

**喵小悟（本话题 AI 助手）与老大的对话**，经 `agent-conversation-log` skill 按同一事件格式写入本地文件，老师看板直接读取展示——用于真实演示「学员 ↔ 顷悟 Agent」数据流。

- **写入端**：`agent-live/events.jsonl`（JSONL，每行一个事件 `{ ts, sid, event, payload }`，`event` 只取 `agent_dialog_req` / `agent_dialog_resp`）
- **写入方式**：`skills/agent-conversation-log/scripts/append_event.py <jsonl绝对路径> --file <事件json>`（Windows 命令行引号安全）
- **读取端**：`monitor/app.js` 每 2 秒 `fetch('../agent-live/events.jsonl')`，与 localStorage 事件**按 ts+sid+event+payload 去重合并**，自动出现在：学生列表（🤖 计数）、时间线（🤖 顷悟 Agent 筛选）、穿透分析（Agent 自由对话面板）
- **注意**：看板必须在 **HTTP 服务**下打开（`file://` 会被 CORS 拦，fetch 失败自动静默，不影响其余功能）

## 埋点上报怎么接正式服务器

`track()` 目前同时做两件事：
1. **demo 演示**：写同源 `localStorage`，监控看板轮询读；
2. **正式上报**：POST 到 `/api/collect`（`ENDPOINT` 常量改成你的服务器地址即可），失败静默。

正式环境建议：服务器收 `{ ts, sid, event, payload }` 按 `sid` 分组存库；监控看板换成轮询 `GET /api/events?since=...`；局域网手机访问：`--bind 0.0.0.0` + 防火墙放行。

> 注意：`project1` 的 SDK 需要顷悟环境注入 app_id 才真正调用 AI；本地直接打开时 `<<APP_ID>>` 未替换，会自动降级成内置模拟回复（不报错、能完整演示埋点与三标签页）。

> 注意：方案A 的 SDK 需要顷悟环境注入 app_id 才真正调用 AI；本地直接打开时 `<<APP_ID>>` 未替换，会自动降级成**内置模拟回复**（不报错、能完整演示埋点）。方案B 本来就是模拟回复，无需任何登录。

## 两种方案差异对比

| 维度 | 方案A · 顷悟 AI 应用 | 方案B · 自写前端 |
|---|---|---|
| 学生登录 | 需要顷悟账户（SDK 弹平台授权窗） | 免登录，打开即用 |
| AI 调用 | 平台 SDK `ai.chat()`，消费者账户扣费 | 自己后端/网关（demo 内置模拟） |
| API Key | 无需（平台 pccc 自动注入） | 自己后端管，前端绝不塞 key |
| 埋点监控 | 在 `ai.chat()` 外包一层，请求/回复全量上报 | 每个动作/输入/回复完全自己掌控上报 |
| 隐蔽性 | 学生能看到顷悟登录窗（平台铁律） | 完全白标，学生无感知 |
| 成本 | 按顷悟用量扣学生/你账户 | 看你自己的 AI 后端成本 |
| 上架 | 可上顷悟商店，自带计费 | 自己托管页面 |
| 适合 | 想用顷悟平台能力、接受平台登录 | 要完全自控、白标、隐蔽监控 |

## 埋点上报怎么接正式服务器

两个学生端的 `app.js` 里都有一段 `track(event, payload)`，目前**同时**做两件事：

1. **demo 演示**：写同源 `localStorage`（key: `ar_class_monitor_events`），监控看板轮询读 → 开 http 服务即可实时看到。
2. **正式上报**：POST 到 `/api/collect`（代码里 `ENDPOINT` 常量，改成你的服务器地址即可），失败静默不影响学生。

正式环境建议：
- 服务器收 `{ ts, sid, event, payload }`，按 `sid` 分组存库；
- 监控看板把读 localStorage 换成轮询 `GET /api/events?since=...`；
- 局域网内手机访问学生端：`python -m http.server 8099 --bind 0.0.0.0` + 防火墙放行。

## 监控端看到的事件类型

| 事件 | 含义 |
|---|---|
| `page_loaded` | 学生进入页面 |
| `idea_submit` | 提交想法（含原文） |
| `ai_chat_req` / `ai_chat_resp` | AI 请求/完整回复 |
| `ai_translate_click` | 点「AI 翻译」 |
| `fields_filled` | 补字段（含所有字段值） |
| `readback_confirm` / `readback_reject` | 回读确认/驳回 |
| `step` | 步骤切换（能看出卡在哪一步） |
| `finish` | 完成，拿到原则卡 |

## 我的建议（供参考）

- **学生端体验**：方案B 更干净——学生进来就是课堂工具，没有平台登录干扰，老师品牌更统一。
- **但要隐蔽监控**：方案B 完全白标，学生无感知，也意味着**合规上要提前告知**（课堂内告知即可）。
- **省事**：方案A 不用自建 AI 后端、不用管 key，顷悟全包。
- 我的推荐：**演示用方案B，正式上线若想省后端可用方案A**；两者埋点代码几乎一样，切换成本低。
