#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AR 教学监控 · 数据服务（数据基座 P1）

职责：
  1. 静态文件服务（替代 python -m http.server，现有页面零改动可访问）
  2. POST /api/collect  接收事件 { ts, sid, event, payload }（或数组），追加到 agent-live/events.jsonl
  3. GET  /api/events   返回事件 JSON 数组，支持 ?since= 增量拉取、?sid= 过滤
  4. CORS 全开（学员作品可能跑在顷悟域名 / 局域网其它端口，需要跨域上报）

用法：
  python server.py [port]        # 默认 8099，绑定 0.0.0.0（局域网可访问）

数据文件：
  agent-live/events.jsonl        # 与 agent-conversation-log skill 同一数据源，单文件统一
"""
import json
import os
import sys
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'agent-live', 'events.jsonl')
SESSION_FILE = os.path.join(BASE_DIR, 'agent-live', 'sessions.json')
IDENTITY_FILE = os.path.join(BASE_DIR, 'agent-live', 'identity.json')
WATER_FILE = os.path.join(BASE_DIR, 'agent-live', 'water.json')
SCREEN_DIR = os.path.join(BASE_DIR, 'agent-live', 'screen')
SCREEN_ACTIVE = os.path.join(SCREEN_DIR, 'active.json')
UPLOAD_DIR = os.path.join(BASE_DIR, 'agent-live', 'uploads')
LESSON_FILE = os.path.join(BASE_DIR, 'agent-live', 'lessons.json')
KEY_FILE = os.path.join(BASE_DIR, '.deepseek_key')


def ensure_data_file():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            f.write('')


def load_events():
    """读全量事件（坏行跳过，保证服务不因脏数据挂掉）"""
    ensure_data_file()
    out = []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                    if isinstance(e, dict) and 'event' in e:
                        out.append(e)
                except Exception:
                    pass
    except Exception:
        pass
    return out


PAGE_COURSE = {
    'warmup': '0', 'lesson1-game': '1', 'lesson2-tool': '2',
    'agent-team': '4', 'student-workbench': None,
}

# 与 lib/analyze.js pickText/taskIdOf 保持一致（服务端只提取原文与课标，穿透判定在前端做）
TEXT_KEYS = ['idea', 'question', 'desc', 'goal', 'text']
COURSE_TASK = {'0': 'pre', '1': 't1', '2': 't2', '4': 't3'}


def pick_text(payload):
    if not isinstance(payload, dict):
        return None
    for k in TEXT_KEYS:
        v = payload.get(k)
        if v and str(v).strip():
            return str(v).strip()
    return None


def task_id_of(payload):
    if not isinstance(payload, dict):
        return None
    t = payload.get('task')
    if t in ('pre', 't1', 't2', 't3'):
        return t
    return COURSE_TASK.get(str(payload.get('course') or ''))


def class_aggregate(events):
    """班级聚合：学生状态 + 每课事件轨迹（供 monitor/bigscreen 展示）。

    返回结构：
      students: {sid: {name, lastTask, lastText, turns, ts}}      —— 学生总览（任意课最近输入）
      byTask:   {pre/t1/t2/t3: {sid: {events: [{event,payload}...最近在前], ts}}}
                                                              —— 每任务×每学生完整作品轨迹
      taskTurn: {pre/t1/t2/t3: 事件数}
      totalTurns: 总事件数
    说明：棱镜穿透判定（每课各自的维度表）由前端 lib/analyze.js gridFor(task, events)
    对 byTask 里每个学生的轨迹跑，服务端不重复实现判定逻辑。
    """
    students = {}
    by_task = {'pre': {}, 't1': {}, 't2': {}, 't3': {}}
    task_turn = {'pre': 0, 't1': 0, 't2': 0, 't3': 0}
    for e in events:
        sid = e.get('sid') or 'anonymous'
        payload = e.get('payload') or {}
        task = task_id_of(payload)
        if task:
            task_turn[task] = task_turn.get(task, 0) + 1
        s = students.setdefault(sid, {'name': sid, 'lastTask': None, 'lastText': None, 'turns': 0, 'ts': 0})
        s['turns'] += 1
        ts = e.get('ts', 0)
        text = pick_text(payload)
        if text:
            s['lastText'] = text
            s['lastTask'] = task or s['lastTask']
            s['ts'] = ts
        if task:
            bt = by_task[task].setdefault(sid, {'events': [], 'ts': 0})
            bt['events'].append({'event': e.get('event'), 'payload': payload})
            bt['ts'] = max(bt['ts'], ts)
    for task in by_task:
        for sid in by_task[task]:
            evs = by_task[task][sid]['events']
            evs.reverse()                     # 最近在前
            by_task[task][sid]['events'] = evs[:200]
    return {'students': students, 'byTask': by_task, 'taskTurn': task_turn, 'totalTurns': len(events)}


def normalize_course(e):
    """老数据可能没带 course：从 payload.page 推断课标，保证按课聚合可用。"""
    p = e.get('payload') or {}
    if not isinstance(p, dict):
        return e
    if p.get('course'):
        return e
    page = p.get('page')
    if page in PAGE_COURSE and PAGE_COURSE[page]:
        p['course'] = PAGE_COURSE[page]
    return e


def append_events(items):
    """追加事件，返回成功条数"""
    ensure_data_file()
    n = 0
    with open(DATA_FILE, 'a', encoding='utf-8') as f:
        for e in items:
            if not isinstance(e, dict) or 'event' not in e:
                continue
            e.setdefault('ts', int(time.time() * 1000))
            e.setdefault('sid', 'anonymous')
            e.setdefault('payload', {})
            normalize_course(e)
            f.write(json.dumps(e, ensure_ascii=False) + '\n')
            n += 1
    return n


# ============================================================
# 课堂场次 + 签到（号码即身份）
#   sessions.json: {"sessions":[{id,title,date,time,numbers,used}], "activeSessionId": "..."}
#   used: {"号码": "01 大熊"}（签到成功的 sid 回填，用于教师端看谁到场）
# ============================================================
def ensure_session_file():
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    if not os.path.exists(SESSION_FILE):
        with open(SESSION_FILE, 'w', encoding='utf-8') as f:
            f.write(json.dumps({'sessions': [], 'activeSessionId': None}, ensure_ascii=False))


def load_sessions():
    ensure_session_file()
    try:
        with open(SESSION_FILE, 'r', encoding='utf-8') as f:
            d = json.load(f)
        if not isinstance(d, dict):
            d = {}
        d.setdefault('sessions', [])
        d.setdefault('activeSessionId', None)
        return d
    except Exception:
        return {'sessions': [], 'activeSessionId': None}


def save_sessions(d):
    ensure_session_file()
    tmp = SESSION_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(tmp, SESSION_FILE)


def new_session(title, date, clock, numbers):
    """新建课堂场次，numbers 是去空去重后的上课号列表"""
    d = load_sessions()
    sid = 's' + str(int(time.time() * 1000))
    d['sessions'].append({
        'id': sid,
        'title': title or '课堂',
        'date': date or '',
        'time': clock or '',
        'numbers': numbers,
        'used': {},
        'created': int(time.time() * 1000),
    })
    d['activeSessionId'] = sid   # 新建即设为当前场次（老师刚建完就是要用的）
    save_sessions(d)
    return sid

def admit_number(number):
    """上课号签到。返回 (ok, sid, reason)"""
    if not number:
        return False, None, '号码为空'
    number = str(number).strip()
    d = load_sessions()
    sess = None
    for s in d['sessions']:
        if s['id'] == d.get('activeSessionId'):
            sess = s
            break
    if not sess:
        return False, None, '还没有进行中的课堂，老师先建课'
    if number not in sess['numbers']:
        return False, None, '号码无效，上不了课'
    if number in sess.get('used', {}):
        return False, None, '该号已签到过'
    sess['used'][number] = {'ts': int(time.time() * 1000)}
    save_sessions(d)
    return True, number, 'ok'


# ============================================================
# 本机身份（学生屏签到后写入，顷悟 agent-conversation-log 上报前读取）
#   解决"这台电脑的顷悟对应哪个上课号"：学生屏在浏览器签到成功后，
#   POST /api/identity {sid} 写入本机 agent-live/identity.json，
#   顷悟 skill 上报对话前 GET /api/identity 拿到同机 sid，两线合流。
# ============================================================
def save_identity(sid):
    ensure_session_file()
    tmp = IDENTITY_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'sid': sid, 'ts': int(time.time() * 1000)}, f, ensure_ascii=False)
    os.replace(tmp, IDENTITY_FILE)


def load_identity():
    d = {'sid': None, 'ts': None, 'valid': False, 'sessionTitle': None}
    try:
        with open(IDENTITY_FILE, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        if isinstance(raw, dict) and raw.get('sid'):
            d['sid'] = raw['sid']
            d['ts'] = raw.get('ts')
            # 校验：该 sid 是否仍是当前场次的有效上课号
            sess = load_sessions()
            cur = None
            for s in sess['sessions']:
                if s['id'] == sess.get('activeSessionId'):
                    cur = s
                    break
            if cur and d['sid'] in cur.get('numbers', []):
                d['valid'] = True
                d['sessionTitle'] = cur.get('title') or '课堂'
    except Exception:
        pass
    return d


# ============================================================
# 课堂任务框架（一节课=一个课程，含 N 个任务；每个任务有 推送/解锁 状态）
#   lessons.json: {"currentLesson":"课1", "lessons":{"课1":{"title":"...","tasks":[
#       {"no":"任务1","title":"...","steps":"...","points":"...","pushed":bool,"unlocked":bool}
#   ]}}}
# ============================================================
def ensure_lesson_file():
    os.makedirs(os.path.dirname(LESSON_FILE), exist_ok=True)
    if not os.path.exists(LESSON_FILE):
        with open(LESSON_FILE, 'w', encoding='utf-8') as f:
            f.write(json.dumps({'currentLesson': None, 'lessons': {}}, ensure_ascii=False))


def load_lessons():
    ensure_lesson_file()
    try:
        with open(LESSON_FILE, 'r', encoding='utf-8') as f:
            d = json.load(f)
        if not isinstance(d, dict):
            d = {}
        d.setdefault('currentLesson', None)
        d.setdefault('lessons', {})
        d.setdefault('projectUnlock', {'1': True, '2': False, '4': False})
        return d
    except Exception:
        return {'currentLesson': None, 'lessons': {}, 'projectUnlock': {'1': True, '2': False, '4': False}}


def save_lessons(d):
    ensure_lesson_file()
    tmp = LESSON_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(tmp, LESSON_FILE)


# ============================================================
# 大屏内容块（每个内容单独存一个文件，教师端控制投屏）
#   screen/<id>.json: {id, type, title, content, source, ts}
#   screen/active.json: {"activeId": "xxx"}  当前投屏的块
#   type: task(课堂任务) / text / image / video / page(网页)
# ============================================================
def ensure_screen_dir():
    os.makedirs(SCREEN_DIR, exist_ok=True)


def list_screen_blocks():
    ensure_screen_dir()
    out = []
    for fn in os.listdir(SCREEN_DIR):
        if not fn.endswith('.json') or fn == 'active.json':
            continue
        try:
            with open(os.path.join(SCREEN_DIR, fn), 'r', encoding='utf-8') as f:
                b = json.load(f)
            if isinstance(b, dict) and b.get('id'):
                out.append(b)
        except Exception:
            pass
    out.sort(key=lambda x: x.get('ts', 0))
    return out


def save_screen_block(block):
    ensure_screen_dir()
    bid = block.get('id')
    if not bid:
        import uuid
        bid = 'blk_' + uuid.uuid4().hex[:8]
        block['id'] = bid
    block['ts'] = int(time.time() * 1000)
    with open(os.path.join(SCREEN_DIR, bid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(block, f, ensure_ascii=False)
    return bid


def get_active_screen():
    ensure_screen_dir()
    try:
        with open(SCREEN_ACTIVE, 'r', encoding='utf-8') as f:
            d = json.load(f)
        return d.get('activeId')
    except Exception:
        return None


def set_active_screen(bid):
    ensure_screen_dir()
    with open(SCREEN_ACTIVE, 'w', encoding='utf-8') as f:
        json.dump({'activeId': bid}, f)


def delete_screen_block(bid):
    ensure_screen_dir()
    try:
        os.remove(os.path.join(SCREEN_DIR, bid + '.json'))
    except Exception:
        pass


def save_upload(filename, b64data):
    """base64 上传文件存到 agent-live/uploads/，返回相对 URL"""
    import base64
    import uuid
    try:
        raw = base64.b64decode(b64data)
    except Exception:
        raise RuntimeError('文件数据解码失败')
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe = os.path.basename(filename or 'upload')
    ext = os.path.splitext(safe)[1].lower() or '.bin'
    fname = uuid.uuid4().hex[:10] + ext
    path = os.path.join(UPLOAD_DIR, fname)
    with open(path, 'wb') as f:
        f.write(raw)
    return '/agent-live/uploads/' + fname


def load_api_key():
    key = os.environ.get('DEEPSEEK_API_KEY', '')
    if not key:
        try:
            with open(KEY_FILE, 'r', encoding='utf-8') as f:
                key = f.read().strip()
        except Exception:
            pass
    return key


def ai_split_tasks(text):
    """调 DeepSeek 把课程内容拆成课堂任务列表。失败抛异常。"""
    api_key = load_api_key()
    if not api_key:
        raise RuntimeError('未配置 API key')
    prompt = (
        '你是课堂任务拆解助手。下面是一节课的教学内容。'
        '请把它拆解成清晰的"课堂任务"列表，每个任务学生要能看懂这一步做什么。\n'
        '要求：\n'
        '1. 按上课顺序拆，任务数按内容自然分（一般 2-6 个）。\n'
        '2. 每个任务包含四个字段：no(如"任务一")、title(一句话任务标题)、steps(这一步具体怎么做，用换行分条)、points(这一步要教/要注意的知识点或注意点，用换行分条)。\n'
        '3. 用 JSON 数组输出，不要多余文字：\n'
        '[{"no":"任务一","title":"...","steps":"...\\n...","points":"...\\n..."}]\n\n'
        '教学内容如下：\n%s' % text
    )
    body = json.dumps({
        'model': 'deepseek-chat',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.4,
        'max_tokens': 2000,
    }, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api_key,
    })
    with urllib.request.urlopen(req, timeout=40) as r:
        resp = json.loads(r.read().decode('utf-8'))
    content = resp['choices'][0]['message']['content'].strip()
    # 提取 JSON（去掉可能的 markdown 围栏）
    if '[' in content:
        content = content[content.index('['):]
        if ']' in content:
            content = content[:content.rindex(']') + 1]
    tasks = json.loads(content)
    if not isinstance(tasks, list):
        raise RuntimeError('AI 返回格式不对')
    # 规范化字段
    out = []
    for i, t in enumerate(tasks, 1):
        out.append({
            'no': t.get('no') or ('任务%d' % i),
            'title': t.get('title') or '任务',
            'steps': t.get('steps') or '',
            'points': t.get('points') or '',
            'pushed': False,
            'unlocked': False,
        })
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    # ---------- 禁缓存：保证三端实时改动不依赖强刷（浏览器默认启发式缓存会坑掉新版）
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    # ---------- CORS ----------
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ---------- 路由 ----------
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/events':
            q = parse_qs(parsed.query)
            try:
                since = float(q.get('since', ['0'])[0])
            except ValueError:
                since = 0
            sidf = q.get('sid', [None])[0]
            events = [e for e in load_events() if e.get('ts', 0) > since]
            if sidf:
                events = [e for e in events if e.get('sid') == sidf]
            self._json(200, events)
            return
        if parsed.path == '/api/session':
            self._json(200, load_sessions())
            return
        if parsed.path == '/api/identity':
            self._json(200, load_identity())
            return
        if parsed.path == '/api/water':
            try:
                with open(WATER_FILE, 'r', encoding='utf-8') as f:
                    self._json(200, json.load(f))
            except Exception:
                self._json(200, {'updated': 0, 'students': {}})
            return
        if parsed.path == '/api/lesson':
            self._json(200, load_lessons())
            return
        if parsed.path == '/api/screen':
            self._json(200, {
                'blocks': list_screen_blocks(),
                'activeId': get_active_screen(),
            })
            return
        if parsed.path == '/api/class':
            agg = class_aggregate(load_events())
            self._json(200, agg)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/admit':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                ok, sid, reason = admit_number(data.get('number'))
                if ok:
                    save_identity(sid)
                self._json(200, {'ok': ok, 'sid': sid if ok else None, 'reason': reason})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/identity':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                sid = (data.get('sid') or '').strip()
                if not sid:
                    self._json(400, {'ok': False, 'reason': 'sid 为空'})
                    return
                save_identity(sid)
                self._json(200, {'ok': True, 'sid': sid})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/split-task':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                text = (data.get('text') or '').strip()
                if not text:
                    self._json(400, {'ok': False, 'reason': '内容为空'})
                    return
                tasks = ai_split_tasks(text)
                self._json(200, {'ok': True, 'tasks': tasks})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/lesson/save':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                lesson_name = (data.get('name') or '').strip()
                if not lesson_name:
                    self._json(400, {'ok': False, 'reason': '课程名称为空'})
                    return
                d = load_lessons()
                d['lessons'][lesson_name] = {
                    'title': lesson_name,
                    'tasks': data.get('tasks') or [],
                }
                d['currentLesson'] = lesson_name
                if data.get('projectUnlock'):
                    d['projectUnlock'] = data['projectUnlock']
                save_lessons(d)
                self._json(200, {'ok': True})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/lesson/unlock':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                d = load_lessons()
                d['projectUnlock'] = data.get('projectUnlock') or d.get('projectUnlock') or {}
                save_lessons(d)
                self._json(200, {'ok': True})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/screen/save':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                if not data.get('title'):
                    self._json(400, {'ok': False, 'reason': '标题为空'})
                    return
                bid = save_screen_block({
                    'id': data.get('id'),
                    'type': data.get('type') or 'text',
                    'title': data.get('title'),
                    'content': data.get('content') or '',
                    'source': data.get('source') or 'teacher',
                })
                self._json(200, {'ok': True, 'id': bid})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/screen/active':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                set_active_screen(data.get('id'))
                self._json(200, {'ok': True})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/screen/delete':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                delete_screen_block(data.get('id'))
                if get_active_screen() == data.get('id'):
                    set_active_screen(None)
                self._json(200, {'ok': True})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/upload':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                url = save_upload(data.get('filename') or 'upload', data.get('data') or '')
                self._json(200, {'ok': True, 'url': url})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/session':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                numbers = [str(n).strip() for n in (data.get('numbers') or []) if str(n).strip()]
                numbers = list(dict.fromkeys(numbers))
                if not numbers:
                    self._json(400, {'ok': False, 'reason': '上课号列表为空'})
                    return
                sid = new_session(data.get('title') or '', data.get('date') or '', data.get('time') or '', numbers)
                self._json(200, {'ok': True, 'sessionId': sid, 'numbers': numbers})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/session/active':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                data = json.loads(raw.decode('utf-8')) if raw else {}
                d = load_sessions()
                if not any(s['id'] == data.get('id') for s in d['sessions']):
                    self._json(400, {'ok': False, 'reason': '场次不存在'})
                    return
                d['activeSessionId'] = data.get('id')
                save_sessions(d)
                self._json(200, {'ok': True})
            except Exception as ex:
                self._json(400, {'ok': False, 'reason': str(ex)})
            return
        if parsed.path == '/api/clear':
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                f.write('')
            self._json(200, {'ok': True, 'cleared': True})
            return
        if parsed.path == '/api/collect':
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw = self.rfile.read(length) if length else b''
                if not raw:
                    self._json(400, {'ok': False, 'error': 'empty body'})
                    return
                data = json.loads(raw.decode('utf-8'))
                items = data if isinstance(data, list) else [data]
                if not isinstance(items[0], dict) or 'event' not in items[0]:
                    self._json(400, {'ok': False, 'error': 'item must contain event field'})
                    return
                n = append_events(items)
                self._json(200, {'ok': True, 'count': n})
            except Exception as ex:
                self._json(400, {'ok': False, 'error': str(ex)})
            return
        self._json(404, {'ok': False, 'error': 'not found'})

    def log_message(self, fmt, *args):
        print('[%s] %s' % (time.strftime('%H:%M:%S'), fmt % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print('AR Monitor Data Service  ->  http://0.0.0.0:%d' % port)
    print('data file: %s' % DATA_FILE)
    print('API: POST /api/collect | GET /api/events?since=...')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
