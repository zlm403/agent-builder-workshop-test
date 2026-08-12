#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qingwu-dialog-bridge.py — 顷悟聊天面板对话 → 老师机监控服务器（常驻转发）

背景：
    学生在顷悟 IDE 聊天面板跟 agent 的每轮对话，都落在本机
    WideWing/Backend/memory/runtime/events.jsonl（user_message + assistant_done）。
    本脚本常驻本机，增量读取该文件，把新对话转发到老师机监控服务器 /api/collect。

用法：
    python qingwu-dialog-bridge.py
    python qingwu-dialog-bridge.py --server http://<老师机IP>:8099 --topic <话题id，默认全转发>

配置：
    --server    老师机监控服务器地址（默认 http://localhost:8099）
    --sleep     轮询间隔秒（默认 2）
    --topic     只转发指定话题 id 的对话（默认全部）
    --no-daemon 前台运行（默认是）

行为：
    - 增量：用本地游标文件记录已转发到的文件偏移/行号，重启不重复发
    - 静默：转发失败静默重试，不打断顷悟使用
    - 事件格式：agent_dialog_req（user_message）/ agent_dialog_resp（assistant_done）
"""

import argparse
import json
import os
import sys
import time
import urllib.request

# 顷悟对话落盘文件（各电脑顷悟安装路径）
DEFAULT_QINGWU_EVENTS = os.path.join(
    os.environ.get('APPDATA', ''),
    'WideWing', 'Backend', 'memory', 'runtime', 'events.jsonl',
)
# 游标文件（记住转发进度）
CURSOR_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.bridge_cursor.json')


def load_cursor():
    try:
        with open(CURSOR_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'offset': 0}


def save_cursor(cursor):
    try:
        with open(CURSOR_FILE, 'w', encoding='utf-8') as f:
            json.dump(cursor, f)
    except Exception:
        pass


def post(server, event, sid, payload):
    body = json.dumps({'ts': int(time.time() * 1000), 'sid': sid, 'event': event, 'payload': payload},
                      ensure_ascii=False).encode('utf-8')
    url = server.rstrip('/') + '/api/collect'
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=5) as r:
        r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--server', default='http://localhost:8099')
    ap.add_argument('--sleep', type=float, default=2.0)
    ap.add_argument('--topic', default=None)
    ap.add_argument('--events', default=DEFAULT_QINGWU_EVENTS)
    args = ap.parse_args()

    cursor = load_cursor()
    offset = cursor.get('offset', 0)
    # 去重集合：已转发过的事件指纹（topic|event|content 前50字），防重发
    sent = set(cursor.get('sent', []))

    print('[bridge] 顷悟对话转发启动')
    print('[bridge] 源文件: %s' % args.events)
    print('[bridge] 转发到: %s' % args.server)
    if args.topic:
        print('[bridge] 只转发话题: %s' % args.topic)
    print('[bridge] 初始偏移: %d, 已去重: %d 条' % (offset, len(sent)))

    # 确认源文件存在
    if not os.path.exists(args.events):
        print('[bridge] 警告: 顷悟事件文件不存在，等待其出现（可能顷悟没开）')
    else:
        size = os.path.getsize(args.events)
        if offset > size:
            offset = 0  # 文件被清空/重建，从头读
            cursor['offset'] = 0

    while True:
        try:
            if not os.path.exists(args.events):
                time.sleep(args.sleep)
                continue
            size = os.path.getsize(args.events)
            if size < offset:
                offset = 0
                cursor['offset'] = 0
            if size <= offset:
                time.sleep(args.sleep)
                continue

            with open(args.events, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(offset)
                new_data = f.read()
                new_offset = f.tell()

            for line in new_data.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                ev = e.get('event')
                d = e.get('data') or {}
                topic = d.get('topic_id') or e.get('topic_id') or ''
                if args.topic and topic != args.topic:
                    continue
                if ev == 'user_message':
                    text = (d.get('text') or d.get('content') or '').strip()
                    if text:
                        fp = topic + '|req|' + text[:50]
                        if fp in sent:
                            continue
                        post(args.server, 'agent_dialog_req', topic, {
                            'text': text, 'task': 't1', 'channel': 'qingwu-ide', 'topic': topic,
                        })
                        sent.add(fp)
                        print('[bridge] req  %s: %s' % (topic, text[:40]))
                elif ev == 'assistant_done':
                    content = (d.get('content') or '').strip()
                    if content:
                        fp = topic + '|resp|' + content[:50]
                        if fp in sent:
                            continue
                        post(args.server, 'agent_dialog_resp', topic, {
                            'reply': content, 'task': 't1', 'channel': 'qingwu-ide', 'topic': topic,
                        })
                        sent.add(fp)
                        print('[bridge] resp %s: %s' % (topic, content[:40]))

            cursor['offset'] = new_offset
            cursor['sent'] = sorted(sent)[-2000:]   # 只保留最近 2000 个指纹
            save_cursor(cursor)
        except Exception as ex:
            print('[bridge] 处理出错（静默继续）: %s' % ex, file=sys.stderr)
        time.sleep(args.sleep)


if __name__ == '__main__':
    main()
