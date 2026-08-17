#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bird-usage.py — 小鸟课堂会话 token 消耗监控（只读，零成本）

用法:
  python bird-usage.py            # 列出所有小鸟课堂会话的 token 消耗
  python bird-usage.py --all      # 不过滤标题，列出全部会话（debug 用）

每次新开一个对话、做完关掉后跑一次，就能看到那一次对话消耗了多少。

过滤规则：标题含「小鸟」或「classroom-v3」的会话（opencode 全局库）。
"""

import sqlite3
import os
import sys
import datetime

DB_PATH = os.path.join(
    os.path.expanduser('~'), '.local', 'share', 'opencode', 'opencode.db',
)


def fmt(n):
    if n >= 1e8:
        return '%.1f亿' % (n / 1e8)
    if n >= 1e4:
        return '%.1f万' % (n / 1e4)
    return str(n)


def main():
    if not os.path.exists(DB_PATH):
        print('未找到 opencode 数据库：%s' % DB_PATH)
        sys.exit(1)

    all_sessions = '--all' in sys.argv
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    now = int(datetime.datetime.now().timestamp() * 1000)
    day_ago = now - 24 * 3600 * 1000

    cur.execute('''
        SELECT id, slug, title, model, time_created, time_updated,
               tokens_input, tokens_output, tokens_cache_read, cost
        FROM session
        ORDER BY time_created DESC
    ''')
    rows = cur.fetchall()

    birds = []
    for r in rows:
        t = (r['title'] or r['slug'] or '')
        if not all_sessions and not ('小鸟' in t or 'classroom-v3' in t.lower()):
            continue
        birds.append(r)

    if not birds:
        print('没找到小鸟课堂会话（标题含「小鸟」）。')
        print('若会话标题是别的，可用 --all 看全部，或告诉我实际命名。')
        sys.exit(0)

    print('%-8s %-38s %10s %9s %12s %8s %12s %s' % (
        '编号', '标题', 'input', 'output', 'cache_read', '花费$', '最近活跃', '创建'))
    print('-' * 106)

    t_in = t_out = t_cache = t_cost = 0.0
    newest = None
    for r in birds:
        title = (r['title'] or r['slug'] or '')[:38]
        created = datetime.datetime.fromtimestamp((r['time_created'] or 0) / 1000).strftime('%m-%d %H:%M')
        upd = datetime.datetime.fromtimestamp((r['time_updated'] or 0) / 1000).strftime('%m-%d %H:%M') if r['time_updated'] else '?'
        inp = r['tokens_input'] or 0
        outp = r['tokens_output'] or 0
        cache = r['tokens_cache_read'] or 0
        cost = r['cost'] or 0
        t_in += inp; t_out += outp; t_cache += cache; t_cost += cost

        mark = ' <<最近' if (r['time_updated'] or 0) >= day_ago else ''
        if not newest or (r['time_updated'] or 0) > (newest['time_updated'] or 0):
            newest = r
        print('%-8s %-38s %10s %9s %12s %8.3f %12s %s%s' % (
            (r['id'] or '')[:8], title, fmt(inp), fmt(outp), fmt(cache), cost, upd, created, mark))

    print('-' * 106)
    print('会话数=%d  input合计=%s  output合计=%s  cache_read合计=%s  花费合计=$%.2f' % (
        len(birds), fmt(t_in), fmt(t_out), fmt(t_cache), t_cost))

    if newest:
        nt = (newest['title'] or newest['slug'] or '')
        print('最近一次：「%s」 input=%s output=%s cache_read=%s 花费=$%.3f' % (
            nt[:40], fmt(newest['tokens_input'] or 0), fmt(newest['tokens_output'] or 0),
            fmt(newest['tokens_cache_read'] or 0), newest['cost'] or 0))


if __name__ == '__main__':
    main()
