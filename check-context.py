#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-context.py — opencode 会话 token 用量监控（轻量，偶尔跑一次即可）

读 opencode 本地数据库，列出每个会话的 token 消耗（input/output/cache_read）、
累计花费、最近活跃时间，帮你判断"哪个会话该收尾换新的了"。

用法:
  python check-context.py            # 全部会话，按最近活跃排序
  python check-context.py --active   # 只看今天活跃的会话

提示:
  - 本脚本只读数据库，不修改任何东西。
  - 想要 AI 主动预警，规则在 AGENTS.md 开发守则第 9 条（上下文健康预警）。
"""

import sqlite3
import os
import sys
import datetime

# opencode 数据库路径（Windows 默认）
DB_PATH = os.path.join(
    os.path.expanduser('~'), '.local', 'share', 'opencode', 'opencode.db',
)
# 各模型大概的上下文窗口上限（token），用于估算"满没满"
MODEL_WINDOW = {
    'deepseek-v4-flash': 128000,
    'deepseek-v4-pro': 128000,
    'deepseek-v4-flash-free': 64000,
}


def fmt(n):
    if n >= 1e8:
        return '%.1f亿' % (n / 1e8)
    if n >= 1e4:
        return '%.1f万' % (n / 1e4)
    return str(n)


def main():
    if not os.path.exists(DB_PATH):
        print('未找到 opencode 数据库：%s' % DB_PATH)
        print('本脚本只支持本机 opencode 的默认存储位置。')
        sys.exit(1)

    active_only = '--active' in sys.argv
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    now = int(datetime.datetime.now().timestamp() * 1000)
    day_ago = now - 24 * 3600 * 1000

    cur.execute('''
        SELECT id, slug, title, model, time_created, time_updated,
               tokens_input, tokens_output, tokens_cache_read, cost
        FROM session
        ORDER BY time_updated DESC
    ''')
    rows = cur.fetchall()

    print('%-30s %-14s %12s %10s %14s %9s %s' % (
        'session', '标题(截)', 'input', 'output', 'cache_read', '花费$', '最近活跃'))
    print('-' * 100)

    total_in = total_cache = total_cost = 0
    active_count = 0
    for r in rows:
        upd = r['time_updated'] or 0
        created = r['time_created'] or 0
        if active_only and upd < day_ago:
            continue
        active_count += 1

        t_in = r['tokens_input'] or 0
        t_out = r['tokens_output'] or 0
        t_cache = r['tokens_cache_read'] or 0
        cost = r['cost'] or 0
        total_in += t_in
        total_cache += t_cache
        total_cost += cost

        title = (r['title'] or r['slug'] or '')[:14]
        upd_str = datetime.datetime.fromtimestamp(upd / 1000).strftime('%m-%d %H:%M') if upd else '?'
        span_h = (upd - created) / 3600000 if created and upd else 0

        # 估算上下文占用（input+cache_read 计入每次发送）
        win = MODEL_WINDOW.get((r['model'] or '').lower().split('/')[-1], 128000)
        est_pct = min(999, (t_in + t_cache) / max(win, 1) * 100)

        mark = ' <<活跃' if upd >= day_ago else ''
        print('%-30s %-14s %12s %10s %14s %9.3f %s%s' % (
            (r['id'] or '')[:30], title,
            fmt(t_in), fmt(t_out), fmt(t_cache), cost, upd_str, mark))

    print('-' * 100)
    print('会话数=%d  input合计=%s  cache_read合计=%s  花费合计=$%.2f' % (
        active_count, fmt(total_in), fmt(total_cache), total_cost))
    print()
    print('提示：cache_read 是"每次调用重发历史"的部分，越大说明上下文越臃肿，')
    print('该会话越该收尾交接、换新会话。判断标准见 AGENTS.md 开发守则第 9 条。')


if __name__ == '__main__':
    main()
