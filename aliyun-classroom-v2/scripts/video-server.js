#!/usr/bin/env node
// =========================================================
// 教室笔记本 视频服务 · 纯 Node 无依赖
// 用法：node scripts/video-server.js （或 npm run video-server）
// 作用：服务 public/videos/ 目录，固定端口 9123。
//       教师端把「视频服务器地址」填成 http://<本机IP>:9123，
//       学生/大屏即优先走笔记本局域网源，笔记本不可达自动回退阿里云公网。
// 支持 Range 请求（拖动进度条不卡）。
// =========================================================
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = 9123;
const VIDEOS_DIR = path.join(__dirname, '..', 'public', 'videos');
const MEDIA_DIR = path.join(__dirname, '..', 'public', 'media');

function ipv4s() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
};

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

// 跨域头：页面跑在阿里云公网（http://8.130.70.114:3000），视频源在本机局域网 9123，
// 浏览器跨域请求需要 CORS + Private Network Access 预检放行，否则本地源被拦、自动回退云端。
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 所有响应统一带 CORS 头；OPTIONS 预检（含 PNA 预检）直接放行
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 根路径：文件名列表 html（教学提示用）
  if (url.pathname === '/') {
    const files = fs.existsSync(VIDEOS_DIR)
      ? fs.readdirSync(VIDEOS_DIR).filter((f) => fs.statSync(path.join(VIDEOS_DIR, f)).isFile()).filter((f) => !f.startsWith('.'))
      : [];
    const items = files.map((f) => `<li><a href="/videos/${encodeURIComponent(f)}">${f}</a></li>`).join('');
    const ips = ipv4s();
    const hint = ips.length ? `http://${ips[0]}:${PORT}` : '（未检测到局域网 IP，请检查网络）';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>教室笔记本视频服务</title></head>
<body style="font-family:sans-serif;background:#0b1220;color:#e2e8f0;padding:24px">
<h2>教室笔记本视频服务（端口 ${PORT}）</h2>
<p>教师端「视频服务器地址」填：<b>${hint}</b></p>
<ul>${items || '<li>（public/videos/ 下还没有视频文件）</li>'}</ul>
</body></html>`);
    return;
  }

  // /videos/<文件名>：返回视频文件（支持 Range）
  if (url.pathname.startsWith('/videos/')) {
    const name = decodeURIComponent(url.pathname.slice('/videos/'.length));
    const file = path.join(VIDEOS_DIR, name);
    if (!file.startsWith(VIDEOS_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      send404(res);
      return;
    }
    serveFile(res, file, req.headers.range);
    return;
  }

  // /api/media/file/<文件名>：媒体库文件（public/media/），兼容前端 SmartVideo 拼出的本地地址（支持 Range）
  if (url.pathname.startsWith('/api/media/file/')) {
    const name = decodeURIComponent(url.pathname.slice('/api/media/file/'.length));
    const file = path.join(MEDIA_DIR, name);
    if (!file.startsWith(MEDIA_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      send404(res);
      return;
    }
    serveFile(res, file, req.headers.range);
    return;
  }

  send404(res);
});

function serveFile(res, file, range) {
  const stat = fs.statSync(file);
  const total = stat.size;
  const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const reqEnd = m && m[2] ? parseInt(m[2], 10) : total - 1;
    const end = Math.min(reqEnd, total - 1);
    if (start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': mime,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Content-Length': total });
    fs.createReadStream(file).pipe(res);
  }
}

server.on('error', (err) => {
  console.error('启动失败：', err.message);
  if (err.code === 'EADDRINUSE') console.error(`端口 ${PORT} 已被占用，请先关闭占用进程。`);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = ipv4s();
  console.log('教室笔记本视频服务已启动');
  console.log('端口：' + PORT);
  console.log('视频目录：' + VIDEOS_DIR);
  console.log('教室局域网学生电脑访问用这个 IP:9123：');
  for (const ip of ips) console.log('  http://' + ip + ':' + PORT);
  if (ips.length === 0) console.log('（未检测到局域网 IPv4，请检查网络）');
});