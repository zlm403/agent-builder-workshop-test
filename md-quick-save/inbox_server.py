import difflib
import json
import os
import re
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
PORT = 8091
SIM_GROUP = 0.6


def load_config():
    default = {"inbox": os.path.join(os.path.expanduser("~"), "Documents", "收件箱")}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
        merged = dict(default)
        merged.update(cfg)
        return merged
    except Exception:
        return default


INBOX = os.path.abspath(load_config()["inbox"])


def inside_inbox(fpath):
    fpath = os.path.normpath(os.path.abspath(fpath))
    root = os.path.normpath(INBOX)
    return fpath == root or fpath.startswith(root + os.sep)


def normalized(text):
    return "".join(text.split()).lower()


def similarity(a, b):
    na, nb = normalized(a), normalized(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return max(len(na), len(nb)) / min(len(na), len(nb)) * 0.5 + 0.5
    return difflib.SequenceMatcher(None, na, nb).ratio()


def preview(text, limit=240):
    flat = re.sub(r"\s+", " ", text).strip()
    if len(flat) <= limit:
        return flat
    return flat[:limit] + "…"


def ts_str(epoch):
    try:
        return datetime.fromtimestamp(epoch).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return ""


def list_files():
    if not os.path.isdir(INBOX):
        return []
    files = []
    for name in os.listdir(INBOX):
        if not name.lower().endswith(".md"):
            continue
        path = os.path.join(INBOX, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            content = ""
        base = name[:-3]
        ver_dir = os.path.join(INBOX, ".versions", base)
        versions = []
        if os.path.isdir(ver_dir):
            for vname in sorted(os.listdir(ver_dir), reverse=True):
                if not vname.lower().endswith(".md"):
                    continue
                vpath = os.path.join(ver_dir, vname)
                try:
                    with open(vpath, encoding="utf-8", errors="ignore") as f:
                        vcontent = f.read()
                except Exception:
                    vcontent = ""
                versions.append({
                    "name": vname,
                    "time": ts_str(os.path.getmtime(vpath)),
                    "size": os.path.getsize(vpath),
                    "preview": preview(vcontent),
                })
        files.append({
            "name": name,
            "path": path,
            "time": ts_str(os.path.getmtime(path)),
            "size": os.path.getsize(path),
            "preview": preview(content),
            "versions": versions,
        })
    files.sort(key=lambda f: os.path.getmtime(f["path"]), reverse=True)
    return files


def group_files(files):
    n = len(files)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(n):
        for j in range(i + 1, n):
            try:
                with open(files[i]["path"], encoding="utf-8", errors="ignore") as f:
                    ci = f.read()
                with open(files[j]["path"], encoding="utf-8", errors="ignore") as f:
                    cj = f.read()
                if similarity(ci, cj) >= SIM_GROUP:
                    union(i, j)
            except Exception:
                pass

    clusters = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(i)
    for members in clusters.values():
        if len(members) < 2:
            continue
        newest = max(members, key=lambda i: os.path.getmtime(files[i]["path"]))
        group_members = [files[k]["name"] for k in members]
        for i in members:
            files[i]["group"] = group_members
            files[i]["newest"] = (i == newest)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/":
            self._send(200, HTML, "text/html; charset=utf-8")
            return

        if path == "/api/files":
            files = list_files()
            group_files(files)
            self._send(200, json.dumps({"inbox": INBOX, "files": files}, ensure_ascii=False))
            return

        if path == "/file":
            name = query.get("name", [""])[0]
            ver = query.get("ver", [None])[0]
            if ver:
                base = name[:-3] if name.lower().endswith(".md") else name
                fpath = os.path.join(INBOX, ".versions", base, ver)
            else:
                fpath = os.path.join(INBOX, name)
            fpath = os.path.abspath(fpath)
            if not inside_inbox(fpath):
                self._send(403, "forbidden")
                return
            if os.path.isfile(fpath):
                try:
                    with open(fpath, encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    self._send(200, content, "text/plain; charset=utf-8")
                except Exception:
                    self._send(500, "error")
            else:
                self._send(404, "not found")
            return

        if path == "/open":
            name = query.get("name", [""])[0]
            ver = query.get("ver", [None])[0]
            if ver:
                base = name[:-3] if name.lower().endswith(".md") else name
                fpath = os.path.join(INBOX, ".versions", base, ver)
            else:
                fpath = os.path.join(INBOX, name)
            fpath = os.path.abspath(fpath)
            if os.path.isfile(fpath):
                os.startfile(fpath)
            self._send(200, "ok")
            return

        if path == "/open_inbox":
            if os.path.isdir(INBOX):
                os.startfile(INBOX)
            self._send(200, "ok")
            return

        self._send(404, "not found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/delete":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            try:
                data = json.loads(body or b"{}")
            except Exception:
                data = {}
            name = data.get("name", "")
            if name and name.lower().endswith(".md"):
                target = os.path.abspath(os.path.join(INBOX, name))
                if inside_inbox(target) and os.path.isfile(target):
                    try:
                        os.remove(target)
                    except Exception:
                        pass
                    base = name[:-3]
                    ver_dir = os.path.join(INBOX, ".versions", base)
                    if os.path.isdir(ver_dir):
                        try:
                            import shutil
                            shutil.rmtree(ver_dir)
                        except Exception:
                            pass
            self._send(200, json.dumps({"ok": True}))
            return
        self._send(404, "not found")


HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>收件箱看板</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; margin: 0; background: #f5f6f8; color: #222; }
  header { background: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; }
  header h1 { font-size: 18px; margin: 0; }
  #search { flex: 1; max-width: 420px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
  button { padding: 7px 14px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; }
  button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
  main { max-width: 920px; margin: 20px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .card .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .card .name { font-size: 15px; font-weight: 600; cursor: pointer; color: #1f2937; }
  .card .meta { font-size: 12px; color: #6b7280; margin-left: auto; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
  .badge.newest { background: #dcfce7; color: #15803d; }
  .badge.dup { background: #fef3c7; color: #b45309; }
  .badge.ver { background: #e0e7ff; color: #4338ca; }
  .preview { font-size: 13px; color: #4b5563; margin: 10px 0 6px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
  .group { font-size: 12px; color: #b45309; margin: 4px 0; }
  .versions { font-size: 12px; color: #4338ca; margin: 4px 0; display: none; }
  .versions.open { display: block; }
  .versions div { padding: 3px 0; border-top: 1px dashed #e5e7eb; }
  .versions a { color: #4338ca; cursor: pointer; margin-right: 8px; }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .actions a, .actions span { font-size: 13px; color: #2563eb; cursor: pointer; text-decoration: none; }
  .actions .del { color: #dc2626; }
  .empty { text-align: center; color: #9ca3af; padding: 60px 0; }
  .full { display: none; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-top: 10px; white-space: pre-wrap; font-size: 13px; line-height: 1.7; max-height: 60vh; overflow: auto; word-break: break-all; }
  .full.open { display: block; }
</style>
</head>
<body>
<header>
  <h1>📥 收件箱看板</h1>
  <input id="search" placeholder="搜内容或文件名…（不记得名字也能搜）">
  <button id="refresh">刷新</button>
  <button id="openInbox">打开收件箱文件夹</button>
</header>
<main id="list"></main>

<script>
let files = [];
const $ = s => document.querySelector(s);

async function load() {
  try {
    const r = await fetch('/api/files');
    const data = await r.json();
    files = data.files || [];
    render();
  } catch (e) {
    $('#list').innerHTML = '<div class="empty">看板服务连不上，请确认它正在运行。</div>';
  }
}

function badgeHtml(f) {
  let h = '';
  if (f.group) h += '<span class="badge dup">与「' + f.group.join('」「') + '」相似</span>';
  if (f.newest) h += ' <span class="badge newest">最新</span>';
  if (f.versions && f.versions.length) h += ' <span class="badge ver">旧版本 ' + f.versions.length + ' 份</span>';
  return h;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = files.filter(f => {
    if (!q) return true;
    const hay = (f.name + ' ' + f.preview + ' ' + (f.versions || []).map(v => v.preview).join(' ')).toLowerCase();
    return hay.includes(q);
  });
  const el = $('#list');
  if (!list.length) { el.innerHTML = '<div class="empty">没有匹配的文档' + (q ? '（换个关键词试试？）' : '') + '</div>'; return; }
  el.innerHTML = list.map((f, i) => {
    const verHtml = (f.versions || []).map(v =>
      '<div><a onclick="openVer(\'' + f.name + '\',\'' + v.name + '\')">打开</a> ' + v.time + '（' + v.size + 'B）' +
      '<span class="verprev">' + v.preview + '</span></div>'
    ).join('');
    return '<div class="card">' +
      '<div class="head"><span class="name" onclick="toggleFull(' + i + ')">' + f.name + '</span>' + badgeHtml(f) +
      '<span class="meta">' + f.time + ' · ' + f.size + 'B</span></div>' +
      '<div class="group" style="display:none"></div>' +
      '<div class="preview">' + escapeHtml(f.preview) + '</div>' +
      (f.versions && f.versions.length ? '<div class="versions"><b>历史版本（旧内容留底）：</b>' + verHtml + '</div>' : '') +
      '<div class="full" id="full' + i + '">' + escapeHtml(f.preview) + '</div>' +
      '<div class="actions">' +
        '<a onclick="toggleFull(' + i + ')">查看全文</a>' +
        (f.versions && f.versions.length ? '<a onclick="toggleVer(this)">历史版本</a>' : '') +
        '<a onclick="copyFull(\'' + f.name + '\')">复制全文</a>' +
        '<a onclick="openMain(\'' + f.name + '\')">打开文件</a>' +
        '<a class="del" onclick="delFile(\'' + f.name + '\')">删除</a>' +
      '</div></div>';
  }).join('');
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toggleFull(i) { $('#full' + i).classList.toggle('open'); }
function toggleVer(btn) { btn.closest('.card').querySelector('.versions').classList.toggle('open'); }

async function copyFull(name) {
  try {
    const r = await fetch('/file?name=' + encodeURIComponent(name));
    const text = await r.text();
    await navigator.clipboard.writeText(text);
    alert('已复制全文到剪贴板');
  } catch (e) { alert('复制失败'); }
}
function openMain(name) { fetch('/open?name=' + encodeURIComponent(name)); }
function openVer(name, ver) { fetch('/open?name=' + encodeURIComponent(name) + '&ver=' + encodeURIComponent(ver)); }

function delFile(name) {
  if (!confirm('确定删除《' + name + '》？连同它的历史版本一起删。')) return;
  fetch('/api/delete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name}) })
    .then(() => load());
}

$('#search').addEventListener('input', render);
$('#refresh').addEventListener('click', load);
$('#openInbox').addEventListener('click', () => fetch('/open_inbox'));
load();
</script>
</body>
</html>
"""


def main():
    os.makedirs(INBOX, exist_ok=True)
    url = "http://127.0.0.1:%d/" % PORT
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        webbrowser.open(url)
        return
    webbrowser.open(url)
    server.serve_forever()


if __name__ == "__main__":
    import urllib.parse
    main()
