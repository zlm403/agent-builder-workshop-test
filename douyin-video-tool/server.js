// ============================================================
// 视频抓取小工具 server.js —— 纯 Node 零依赖本地服务
// 监听 127.0.0.1:8120
//   GET    /                    -> public/index.html
//   GET    /api/state           -> {tasks:[...], videos:[...]}
//   POST   /api/fetch           -> {url} 加入串行下载队列
//   DELETE /api/videos/<文件名>  -> 删视频文件 + 更新 meta.json
//   GET    /video/<文件名>      -> 流式播放（支持 Range / 206）
// 下载：child_process spawn yt-dlp，同一时间只跑 1 个
// 启动参数 --smoke：GET / 返回 200 后打印一行 OK 并自行退出（自动化验收用）
// ============================================================
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8120;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VIDEOS_DIR = path.join(ROOT, 'videos');
const META_FILE = path.join(VIDEOS_DIR, 'meta.json');

const tasks = [];      // 全部下载任务（排队中 + 下载中 + 已结束）
let taskSeq = 1;
let running = false;   // 并发锁：同一时间只跑 1 个下载
let currentChild = null;

// ---------------- 视频库 ----------------
let videos = [];

function saveMeta() {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(videos, null, 2), 'utf8');
  } catch (e) { /* 写失败不阻塞服务 */ }
}

// 启动时扫描 videos 目录，重建已入库列表
function scanVideos() {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  let meta = [];
  if (fs.existsSync(META_FILE)) {
    try { meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8')); } catch (e) { meta = []; }
  }
  const seen = new Set();
  videos = [];
  for (const v of (Array.isArray(meta) ? meta : [])) {
    if (v && v.filename && /\.mp4$/i.test(v.filename) && fs.existsSync(path.join(VIDEOS_DIR, v.filename))) {
      videos.push(v);
      seen.add(v.filename);
    }
  }
  // 目录里 meta 没登记的 mp4 补登记
  let changed = false;
  for (const f of fs.readdirSync(VIDEOS_DIR)) {
    if (!/\.mp4$/i.test(f) || seen.has(f)) continue;
    let st;
    try { st = fs.statSync(path.join(VIDEOS_DIR, f)); } catch (e) { continue; }
    videos.push({ filename: f, title: f, size: st.size, addedAt: Math.round(st.mtimeMs) || Date.now(), durationSec: 0 });
    seen.add(f);
    changed = true;
  }
  videos.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  if (changed) saveMeta();
  // 异步补时长，不阻塞启动
  for (const v of videos) {
    if (!v.durationSec) {
      ffprobeDuration(path.join(VIDEOS_DIR, v.filename)).then((d) => {
        if (d > 0) { v.durationSec = d; saveMeta(); }
      });
    }
  }
}

function ffprobeDuration(file) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => {
      const v = parseFloat(String(out).trim());
      resolve(Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    });
    p.on('error', () => resolve(0));
  });
}

// ---------------- 下载队列（串行） ----------------
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// 爬 URL 里的视频 id（/一串数字/ 的一截），没有纯数字段则退回任意数字段，再兜底用 URL hash
function extractId(url) {
  const segs = url.split('/');
  for (let i = segs.length - 1; i >= 0; i--) {
    if (/^[0-9]+$/.test(segs[i])) return segs[i];
  }
  const any = url.match(/[0-9]+/);
  if (any) return any[0];
  return 'v' + simpleHash(url);
}

function enqueue(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return { ok: false, error: 'URL 不能为空' };
  // 同 URL 已有任务（失败过的允许重试）
  const dupTask = tasks.find((t) => t.url === url && t.status !== 'failed');
  if (dupTask) return { ok: true, taskId: dupTask.id, dup: true };
  const fileId = extractId(url);
  const filename = fileId + '.mp4';
  // 同 id 文件已在库里
  if (videos.some((v) => v.filename === filename)) {
    return { ok: true, taskId: -1, dup: true };
  }
  const task = { id: taskSeq++, url, status: 'queued', progress: 0, speed: '', title: '', filename, error: '', fileId };
  tasks.push(task);
  runNext();
  return { ok: true, taskId: task.id };
}

function runNext() {
  if (running) return;
  const next = tasks.find((t) => t.status === 'queued');
  if (!next) return;
  running = true;
  next.status = 'downloading';
  startDownload(next);
}

function looksProgress(line) {
  return /^\s*\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?/.test(line);
}

function parseProgress(task, line) {
  const m = /^\s*(\S+)\s*\/\s*(\S+)\s*(.*?)\s*$/.exec(line);
  if (!m) return;
  const dl = parseFloat(m[1]);
  const total = parseFloat(m[2]);
  const spd = String(m[3] || '').trim() === 'NA' ? '' : String(m[3] || '').trim();
  if (Number.isFinite(dl) && Number.isFinite(total) && total > 0) {
    task.progress = Math.min(99, Math.max(0, Math.round((dl / total) * 100)));
    task.speed = spd;
  } else {
    task.progress = -1;   // 未知
    task.speed = spd;
  }
}

function startDownload(task) {
  const outTemplate = path.join(VIDEOS_DIR, task.fileId + '.%(ext)s');
  const args = [
    '--no-playlist',
    '-f', 'bv*+ba/b',
    '--merge-output-format', 'mp4',
    '--no-warnings',
    '--print', 'title',
    '--newline',
    '--progress-template', '%(progress.downloaded_bytes)s/%(progress.total_bytes)s %(progress.speed)s',
    '-o', outTemplate,
    task.url
  ];

  const stderrTail = [];
  let gotTitle = false;
  let bufOut = '';
  let bufErr = '';
  let settled = false;

  // 第一行 stdout = 标题；进度行走 stdout 或 stderr 都能解析（跨版本稳妥）
  const onStdoutLine = (line) => {
    const l = line.replace(/\r$/, '').trim();
    if (!l) return;
    if (!gotTitle) { gotTitle = true; task.title = l; return; }
    if (looksProgress(l)) parseProgress(task, l);
  };
  const onStderrLine = (line) => {
    const l = line.replace(/\r$/, '').trim();
    if (!l) return;
    if (looksProgress(l)) { parseProgress(task, l); return; }
    stderrTail.push(l);
    if (stderrTail.length > 2) stderrTail.shift();   // 只保留最后 2 行
  };

  const child = spawn('yt-dlp', args, { cwd: ROOT });
  currentChild = child;

  child.stdout.on('data', (d) => {
    bufOut += d.toString('utf8');
    let i;
    while ((i = bufOut.indexOf('\n')) !== -1) {
      const line = bufOut.slice(0, i);
      bufOut = bufOut.slice(i + 1);
      onStdoutLine(line);
    }
  });
  child.stderr.on('data', (d) => {
    bufErr += d.toString('utf8');
    let i;
    while ((i = bufErr.indexOf('\n')) !== -1) {
      const line = bufErr.slice(0, i);
      bufErr = bufErr.slice(i + 1);
      onStderrLine(line);
    }
  });

  const finish = (code) => {
    if (settled) return;
    settled = true;
    if (bufOut.trim()) onStdoutLine(bufOut);   // 处理无换行符的残留
    if (bufErr.trim()) onStderrLine(bufErr);

    if (code === 0) {
      const target = path.join(VIDEOS_DIR, task.filename);
      let st = null;
      try { st = fs.statSync(target); } catch (e) { st = null; }
      if (!st || !st.isFile()) {
        task.status = 'failed';
        task.error = '下载完成后未找到输出文件';
      } else {
        task.status = 'done';
        task.progress = 100;
        task.speed = '';
        const entry = { filename: task.filename, title: task.title || task.filename, size: st.size, addedAt: Date.now(), durationSec: 0 };
        videos.unshift(entry);            // 先入库，时长异步补
        saveMeta();
        ffprobeDuration(target).then((dur) => {
          if (dur > 0) { entry.durationSec = dur; saveMeta(); }
        });
      }
    } else {
      task.status = 'failed';
      task.error = stderrTail.join('\n') || ('下载失败（退出码 ' + code + '）');
    }
    running = false;
    runNext();
  };

  child.on('close', (code) => finish(code === null ? -1 : code));
  child.on('error', (err) => {
    if (settled) return;
    settled = true;
    task.status = 'failed';
    task.error = '无法启动 yt-dlp: ' + err.message;
    running = false;
    runNext();
  });
}

// ---------------- HTTP 服务 ----------------
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1024 * 1024) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', () => resolve(data));
    req.on('error', (e) => reject(e));
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { sendJson(res, 404, { ok: false, error: '文件不存在' }); return; }
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
    res.end(data);
  });
}

function safeBasename(name) {
  name = path.basename(String(name || ''));
  if (!name || name === '.' || name === '..' || /[<>"|?*]/.test(name)) throw new Error('非法文件名');
  return name;
}

// 流式播放，必须支持 HTTP Range（206），否则播放器进度条拖不动
function serveVideo(req, res, name) {
  let filePath;
  try { filePath = path.join(VIDEOS_DIR, safeBasename(name)); } catch (e) { sendJson(res, 400, { ok: false, error: '非法文件名' }); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { sendJson(res, 404, { ok: false, error: '视频不存在' }); return; }
    const size = st.size;
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/i.exec(range);
      let start = 0;
      let end = size - 1;
      if (m) {
        if (m[1] !== '' && m[2] !== '') { start = parseInt(m[1], 10); end = parseInt(m[2], 10); }
        else if (m[1] !== '') { start = parseInt(m[1], 10); }
        else if (m[2] !== '') { start = size - parseInt(m[2], 10); }   // suffix-range: bytes=-N
        else { start = 0; }
      }
      if (!Number.isFinite(start) || !Number.isFinite(end)) { start = 0; end = size - 1; }
      if (start < 0) start = 0;
      if (end >= size) end = size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + size });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      });
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => { try { res.destroy(); } catch (e) { /* noop */ } });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': size,
        'Accept-Ranges': 'bytes'
      });
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => { try { res.destroy(); } catch (e) { /* noop */ } });
      stream.pipe(res);
    }
  });
}

function handleDelete(name, res) {
  let filePath;
  try { filePath = path.join(VIDEOS_DIR, safeBasename(name)); } catch (e) { sendJson(res, 400, { ok: false, error: '非法文件名' }); return; }
  fs.unlink(filePath, (err) => {
    if (err) { sendJson(res, 404, { ok: false, error: '文件不存在' }); return; }
    videos = videos.filter((v) => v.filename !== name);
    saveMeta();
    sendJson(res, 200, { ok: true });
  });
}

function cleanTask(t) {
  return { id: t.id, url: t.url, status: t.status, progress: t.progress, speed: t.speed, title: t.title || '', filename: t.filename, error: t.error || '' };
}

const server = http.createServer((req, res) => {
  let p = '';
  try {
    p = decodeURIComponent(new URL(req.url, 'http://' + HOST + ':' + PORT).pathname);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: '非法请求路径' });
    return;
  }
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    } else if (req.method === 'GET' && p === '/api/state') {
      sendJson(res, 200, { tasks: tasks.map(cleanTask), videos });
    } else if (req.method === 'POST' && p === '/api/fetch') {
      readBody(req).then((body) => {
        let jsonObj = {};
        try { jsonObj = JSON.parse(body || '{}'); } catch (e) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' }); return; }
        const r = enqueue(typeof jsonObj.url === 'string' ? jsonObj.url : '');
        sendJson(res, r.ok ? 200 : 400, r);
      }).catch(() => sendJson(res, 400, { ok: false, error: '读取请求体失败' }));
    } else if (req.method === 'DELETE' && /^\/api\/videos\/[^/]+$/.test(p)) {
      handleDelete(p.split('/').pop(), res);
    } else if (req.method === 'GET' && p.startsWith('/video/')) {
      serveVideo(req, res, p.slice('/video/'.length));
    } else {
      sendJson(res, 404, { ok: false, error: 'Not Found' });
    }
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String((err && err.message) || err) });
  }
});

server.on('error', (e) => {
  console.error('启动失败: ' + e.message);
  process.exit(1);
});

process.on('SIGINT', () => { if (currentChild) { try { currentChild.kill(); } catch (e) { /* noop */ } } process.exit(0); });
process.on('SIGTERM', () => { if (currentChild) { try { currentChild.kill(); } catch (e) { /* noop */ } } process.exit(0); });

scanVideos();
server.listen(PORT, HOST, () => {
  console.log('视频抓取小工具已启动: http://127.0.0.1:' + PORT);
  if (process.argv.includes('--smoke')) {
    // 自动化验收：GET / 等 200 再打印 OK，然后自行退出
    const req = http.get('http://' + HOST + ':' + PORT + '/', (r) => {
      const ok = r.statusCode === 200;
      console.log(ok ? 'OK' : 'FAIL ' + r.statusCode);
      process.exit(ok ? 0 : 1);
    });
    req.on('error', () => { console.log('FAIL'); process.exit(1); });
  }
});