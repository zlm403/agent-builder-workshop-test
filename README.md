# AI Agent 互动试听课系统 — Sprint 1 共用底座（可运行版）

技术栈：Next.js 14 (App Router) + Prisma + Supabase PostgreSQL + SSE 实时同步。

## 已实现的 Sprint 1 闭环

- 教师创建课堂 → 自动生成 6 位邀请码 + 入场二维码
- 学生扫码 / 输码进入 → 分配匿名 ID + 断线恢复令牌
- 教师开始 → 逐环节推进 / 跳转 / 锁定
- 学生端自动跟随当前环节，完成投票 / 短文本 / 资料选择并提交
- 教师端 + 大屏通过 SSE 实时显示全班进度
- 每名学生每模块状态落库（ModuleProgress），含审计日志

> 方案 B 接口已通过 `CourseTemplate.version` 预留；后续 Sprint 只需补模块配置与专属交互，不重建底层。

## 运行步骤

### 1. 配置 Supabase 连接

复制 `.env.example` 为 `.env`，填入你的 Supabase 连接串：

```bash
cp .env.example .env
```

复制 Supabase 控制台 → Project Settings → Database → Connection pooling 里的连接串。
**踩坑结论（已验证）**：不要用 `db.<项目ref>.supabase.co:5432` 直连（新项目默认 IPv6 only，本地无 IPv6 会 `ENOTFOUND`）；也**不要**用事务池化器 **6543 端口**（Prisma `db push` 需要 session 级命令，在 6543 上会卡死无输出）。
正确用法是用 **Session Pooler（同为 5432 端口）**，host 形如 `aws-0-<区域>.pooler.supabase.com`，并加 `?sslmode=require`：

```
DATABASE_URL="postgresql://postgres.<项目ref>:<你的密码>@aws-0-<区域>.pooler.supabase.com:5432/postgres?sslmode=require"
```

- 区域必须选对（本项目在东京 `ap-northeast-1`，连错区域报 `tenant not found`）。
- 用户名为 `postgres.<项目ref>`（带点，不是纯 `postgres`）。
- 需放开网络限制（Database → Network restrictions → Allow all access，或加本地出口 IP）。

并确认 `NEXT_PUBLIC_BASE_URL` 指向你的访问地址（本地默认 `http://localhost:3000`）。

### 2. 推送数据库结构

```bash
npm install        # 已安装可跳过
npx prisma db push # 在 Supabase 中建表
npm run db:seed    # 写入方案 A 默认课程模板（也可由系统首次运行时自动创建）
```

### 3. 启动

```bash
npm run dev        # 开发模式，访问 http://localhost:3000
# 或
npm run build && npm start
```

## 演示流程

1. 打开 `/teacher` → 点击「创建课堂（方案 A）」→ 记下邀请码与二维码
2. 新开标签页打开 `/screen?sessionId=<上面生成的id>`（投影端）
3. 学生打开 `/student?code=<邀请码>`（或扫二维码）→ 输入昵称进入
4. 教师端点「开始课堂」，再点「下一环节」推进；学生端自动同步
5. 学生在手机完成投票/提交；教师端与大屏实时看到进度条

## 目录结构

```
src/
  app/
    api/                 # 课堂/学生/模块/进度/实时(SSE) 接口
    (teacher)/          # 教师导演台
    (student)/          # 学生互动端
    (screen)/            # 课堂大屏
  lib/
    db.ts                # Prisma 单例
    realtime.ts          # 内存事件总线（可替换为 Supabase Realtime）
    ids.ts               # 邀请码/匿名ID/恢复令牌生成
    types.ts             # 模块配置类型
    courseConfig.ts      # 课程模板（配置驱动）
    classroom.ts         # 课堂业务编排（含审计与实时推送）
prisma/schema.prisma     # 核心实体 Schema
docs/                    # 8 份需求/技术/验收规格
```

## 已知边界（Sprint 1 范围外）

- AI 调用、Skills、Agent 配置/工作流/前后对比：Sprint 2
- 作品发布、互测、投屏审核、内容审核、数据导出：Sprint 3
- 实时同步当前为单实例内存方案；多实例部署需将 `src/lib/realtime.ts` 换成 Supabase Realtime 或 Redis Pub/Sub
- 方案 B 完整模块待附件二解析后补齐
