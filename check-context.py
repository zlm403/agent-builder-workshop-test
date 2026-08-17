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
  - 本脚本只读数据库，不修改任何东西（唯一的写入是标记文件，记录已报过的累计档位）。
  - 想要 AI 主动预警，规则在 AGENTS.md 开发守则第 9 条（上下文健康预警）。
  - 跨累计 1000 万 token 档位时，脚本会打印一条彩色横幅（本地位标记，不经过 AI、不耗 token）。
"""

import sqlite3
import os
import sys
import datetime

# 累计 token 里程碑档位（跨会话 input+cache_read 合计），每跨一档打印彩色横幅
MILESTONE = 10_000_000
# 标记文件：记录上次已报过的档位数，与数据库同目录，避免污染工作区
MARKER_NAME = 'context-milestone.txt'

# ANSI 颜色（Windows Terminal / 现代终端可直接渲染）
MAGENTA = '\x1b[35m'
BOLD = '\x1b[1m'
RESET = '\x1b[0m'

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


def milestone_banner(total):
    """跨累计 MILESTONE 整数档位时打印彩色横幅，并更新标记文件。返回是否触发。"""
    marker = os.path.join(os.path.dirname(DB_PATH), MARKER_NAME)
    level = int(total // MILESTONE)

    last = 0
    first_run = True
    if os.path.exists(marker):
        first_run = False
        try:
            with open(marker, encoding='utf-8') as f:
                last = int(f.read().strip() or 0)
        except (ValueError, OSError):
            last = 0

    if level <= last:
        return False

    try:
        with open(marker, 'w', encoding='utf-8') as f:
            f.write(str(level))
    except OSError:
        pass

    # 首次运行：只落标记，不刷屏（避免一次报几百档）
    if first_run:
        return False

    n = level * MILESTONE
    print()
    print('%s%s==============================================%s' % (MAGENTA, BOLD, RESET))
    print('%s%s  [里程碑] 累计已消耗 %s token（input+cache_read）！%s' % (
        MAGENTA, BOLD, fmt(n), RESET))
    print('%s%s  %s 是第 %d 个千万档，进度记录已更新。%s' % (
        MAGENTA, BOLD, fmt(n), level, RESET))
    print('%s%s  上下文健康判断仍看 AGENTS.md 第 9 条。%s' % (MAGENTA, BOLD, RESET))
    print('%s%s==============================================%s' % (MAGENTA, BOLD, RESET))
    print()
    return True


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

    milestone_banner(total_in + total_cache)

    print()
    print('提示：cache_read 是"每次调用重发历史"的部分，越大说明上下文越臃肿，')
    print('该会话越该收尾交接、换新会话。判断标准见 AGENTS.md 开发守则第 9 条。')
    print('提示：累计跨 1000 万档的彩色横幅由脚本本地打印，不经过 AI、不耗 token；')
    print('      标记文件记录在 %s 同目录下（context-milestone.txt）。' % DB_PATH)


if __name__ == '__main__':
    main()
