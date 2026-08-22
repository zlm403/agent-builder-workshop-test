#!/usr/bin/env node
// =========================================================
// 一键替换环节页内容为 HTML 文件（内容页专用）
//
// 用法（在项目根目录执行）：
//   node scripts/replace-page-html.js <group:refKey> <html 文件路径> [标题]
//
// 例：
//   node scripts/replace-page-html.js a2:s1 "C:\Users\me\Desktop\page1.html"
//   node scripts/replace-page-html.js a2:s1 "page1.html" "发布任务"
//
// group:refKey 是环节页的身份标识（见 src/lib/pages.ts）：
//   A2 内容页：a2:hook 钩子开场 / a2:s1 发布任务 / a2:s2 产生疑问 / a2:s3 找到方法 /
//              a2:s7 认知思考 / a2:s9 未来展开 / a2:s10 最后升华
//   A1 内容页：avatar:c1..c6 / avatar:html07 / avatar:c11
//
// 做的事（一次完成）：
//   1. 把 HTML 文件复制进 public/media/（用时间戳命名，走 /api/media/file/ 动态路由，无需重启即生效）
//   2. 清空该内容页原有的全部内容块（只留背景）
//   3. 插入一个「网页」内容块指向这份 HTML
//   4. 打印操作结果
// =========================================================
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*(DATABASE_URL|LLM_[A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ 未找到 DATABASE_URL（.env.local / .env）');
    process.exit(1);
  }
}

async function main() {
  const [refArg, htmlPath, titleArg] = process.argv.slice(2);
  if (!refArg || !htmlPath) {
    console.error(`
用法：node scripts/replace-page-html.js <group:refKey> <html 文件路径> [标题]
例：  node scripts/replace-page-html.js a2:s1 "C:\\Users\\me\\Desktop\\page1.html"
`);
    process.exit(1);
  }

  const m = refArg.match(/^([A-Za-z0-9]+):(.+)$/);
  if (!m) {
    console.error(`❌ 参数格式应为 group:refKey，例如 a2:s1。收到：${refArg}`);
    process.exit(1);
  }
  const group = m[1].toUpperCase();
  const refKey = refArg;

  const absHtml = path.resolve(htmlPath);
  if (!fs.existsSync(absHtml)) {
    console.error(`❌ HTML 文件不存在：${absHtml}`);
    process.exit(1);
  }

  loadEnv();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await prisma.$disconnect(); } };

  try {
    const page = await prisma.lessonPage.findFirst({ where: { group, refKey } });
    if (!page) {
      const avail = await prisma.lessonPage.findMany({
        where: { group },
        select: { refKey: true, title: true, kind: true },
        orderBy: { seq: 'asc' },
      });
      console.error(`❌ 没找到 ${group} 组里 refKey=${refKey} 的页面。`);
      console.error(`   该组可用页面（${avail.length} 个）：`);
      for (const a of avail) {
        console.error(`   - ${a.refKey ?? '(新内容页)'} [${a.kind}] ${a.title ?? ''}`);
      }
      console.error('   提示：只能替换 kind=content 的内容页；内置功能页（builtin）不可替换。');
      await close();
      process.exit(1);
    }
    if (page.kind !== 'content') {
      console.error(`❌ ${refKey} 是内置功能页（${page.title}），不是内容页，不能整页替换成 HTML。`);
      console.error('   内容页 = 教师端「编辑本页」可编辑的页；内置功能页请用媒体库内容块或隐藏。');
      await close();
      process.exit(1);
    }

    const slot = `page:${page.id}`;

    // 1. 复制 HTML 到 public/media/
    const mediaDir = path.resolve(__dirname, '..', 'public', 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const safeKey = refKey.replace(/[^A-Za-z0-9_-]/g, '-');
    const fname = `${safeKey}-${ts}.html`;
    fs.copyFileSync(absHtml, path.join(mediaDir, fname));
    const url = `/api/media/file/${fname}`;

    // 2. 清空该页内容块
    const { count } = await prisma.mediaItem.deleteMany({ where: { slot } });

    // 3. 插入网页内容块
    const item = await prisma.mediaItem.create({
      data: {
        title: titleArg?.trim() || page.title || safeKey,
        kind: 'embed',
        url,
        content: null,
        slot,
        sort: 0,
        align: 'center',
        hidden: false,
      },
    });

    console.log('✅ 替换完成：');
    console.log(`   页面：${group} / ${refKey}（${page.title ?? ''}）`);
    console.log(`   已清空 ${count} 个旧内容块`);
    console.log(`   HTML → ${fname}`);
    console.log(`   访问地址：${url}`);
    console.log(`   新内容块：${item.title} [网页]`);
    console.log('');
    console.log('   大屏刷新后即可看到（内容页 5 秒自动刷新）。');
  } catch (e) {
    console.error('❌ 执行出错：', e);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

main();
