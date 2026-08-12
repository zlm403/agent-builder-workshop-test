#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
water-analyzer.py — 学习水位自动分析服务（常驻）

读监控服务器 events.jsonl 里每个学生的行为/对话，
对照六大知识点规则，算出每个知识点的"水位"(0-100)；
再调 DeepSeek API 对每个知识点生成针对性分析文本（引用学生真实行为）。
写入 agent-live/water.json。学生端「学习水位」和教师端诊断读取该文件。

用法:
  python water-analyzer.py
  python water-analyzer.py --sleep 30

依赖:
  - 与监控服务器同机（读 events.jsonl + 写 water.json）
  - API key 从环境变量 DEEPSEEK_API_KEY 或本地 .deepseek_key 文件读取（不写死在代码）
  - AI 调用失败时自动回退到规则分析文本，服务不挂
"""

import json
import os
import sys
import time
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EVENTS_FILE = os.path.join(BASE_DIR, 'agent-live', 'events.jsonl')
OUT_FILE = os.path.join(BASE_DIR, 'agent-live', 'water.json')
KEY_FILE = os.path.join(BASE_DIR, '.deepseek_key')

DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
DEEPSEEK_MODEL = 'deepseek-chat'


def load_api_key():
    """从环境变量或本地 key 文件读 DeepSeek key（不写死在代码里）"""
    key = os.environ.get('DEEPSEEK_API_KEY', '')
    if not key:
        try:
            with open(KEY_FILE, 'r', encoding='utf-8') as f:
                key = f.read().strip()
        except Exception:
            pass
    return key


def ai_analyze(api_key, sid, item, evs):
    """调 DeepSeek 对某个知识点生成分析文本。失败返回 None（调用方回退规则版）。"""
    if not api_key:
        return None
    # 整理学生该知识点的相关行为
    samples = []
    for e in evs[:12]:
        pl = e.get('payload') or {}
        txt = pl.get('text') or pl.get('reply') or ''
        if txt:
            samples.append('%s: %s' % (e.get('event'), txt[:120]))
    if not samples:
        samples.append('（暂无对话内容）')
    prompt = (
        '你是课堂学习分析助手。下面是一个学生在课堂上的行为记录。'
        '针对知识点「%s」，请用 2-3 句话给出这个学生在这块的掌握情况分析：'
        '说清楚他做得好在哪里 / 做得不好在哪里、可能的原因、以及一句可执行的改进建议。'
        '语气平等不评判，不要贴"笨/不会"标签，不要用"你"开头反复责备，用中文。\n\n'
        '学生行为记录：\n%s\n\n'
        '请只输出分析内容本身，不要标题。'
    ) % (item['name'], '\n'.join(samples))
    body = json.dumps({
        'model': DEEPSEEK_MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.6,
        'max_tokens': 300,
    }, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(DEEPSEEK_URL, data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api_key,
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            resp = json.loads(r.read().decode('utf-8'))
        content = resp['choices'][0]['message']['content'].strip()
        return content if content else None
    except Exception as ex:
        print('[water] AI 调用失败（回退规则版）: %s' % ex, file=sys.stderr)
        return None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EVENTS_FILE = os.path.join(BASE_DIR, 'agent-live', 'events.jsonl')
OUT_FILE = os.path.join(BASE_DIR, 'agent-live', 'water.json')

# 六大知识点规则：判断信号 + 分析话术（好/不好）
WATER_ITEMS = [
    {
        'key': 'speak', 'name': '把话说清楚', 'icon': '🗣️',
        'signals': ['student_ask', 'agent_dialog_req'],
        'good': '你有多次跟 AI 提要求、说想法的记录，说明你已经会主动开口表达需求，这是最关键的一步。',
        'bad': '你还没怎么开口跟 AI 提过要求。试着把你想要的东西说成一句话，哪怕说砸了也没关系，AI 会帮你补。',
    },
    {
        'key': 'plan', 'name': '知道下一步', 'icon': '🧭',
        'signals': ['task_view', 'page_loaded'],
        'good': '你确认过任务、打开过作品，说明你知道自己该干什么、项目推进到哪里。',
        'bad': '还没看到你确认任务或打开作品的记录。先点「收到任务」，再跟着引导一步一步走。',
    },
    {
        'key': 'tools', 'name': '会用手里的工具', 'icon': '🛠️',
        'signals': ['page_loaded', 'game_start', 'tool_submit', 'game_score', 'game_over'],
        'good': '你有打开并运行作品的记录，说明你已经会用顷悟把作品跑起来。',
        'bad': '还没看到你运行作品的记录。试着打开顷悟做的东西、点运行，把它跑起来。',
    },
    {
        'key': 'fix', 'name': '做错了会修', 'icon': '🔧',
        'signals': ['student_ask', 'agent_dialog_req', 'readback_reject', 'tool_result'],
        'good': '你发现问题后主动说给 AI 听、让它改，这是最值钱的能力——会修，就能一直做下去。',
        'bad': '还没看到你修改作品的记录。作品不对、不好玩，都是正常的——把"哪里不对"说给 AI 听，让它改。',
    },
    {
        'key': 'save', 'name': '怕弄丢会存档', 'icon': '💾',
        'signals': ['finish', 'task_view', 'task_push'],
        'good': '你有完成和确认的记录，说明你懂得把做好的东西收好、有交代。',
        'bad': '还没看到你收尾/确认的记录。做完一步就保存、确认一下，别让成果丢了。',
    },
    {
        'key': 'memory', 'name': '记得住接得上', 'icon': '🔗',
        'signals': ['agent_dialog_req', 'agent_dialog_resp'],
        'good': '你和 AI 有多轮来回，说明对话能接得上，前面说的后面还记得。',
        'bad': '还没看到你和 AI 的连续对话。多聊几轮，让 AI 记住你前面说过的话。',
    },
]


def load_events():
    try:
        rows = []
        for line in open(EVENTS_FILE, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
        return rows
    except Exception:
        return []


def analyze_student(sid, evs, api_key=''):
    """算六知识点水位（规则）+ 深度分析文本（AI，失败回退规则）"""
    event_names = set(e.get('event') for e in evs)
    total_text = sum(1 for e in evs if (e.get('payload') or {}).get('text') or (e.get('payload') or {}).get('reply'))
    result = []
    for item in WATER_ITEMS:
        hits = sum(1 for s in item['signals'] if s in event_names)
        pct = min(100, round(hits / len(item['signals']) * 100))
        # 对话越多，"把话说清楚/记得住"水位越高
        if item['key'] == 'speak' and total_text >= 3:
            pct = max(pct, 90)
        if item['key'] == 'memory' and total_text >= 2:
            pct = max(pct, 70)
        if item['key'] == 'plan' and total_text >= 1:
            pct = max(pct, 40)
        level = 'high' if pct >= 75 else ('mid' if pct >= 40 else 'low')
        tip = '练得不错' if level == 'high' else ('练到一半' if level == 'mid' else '还没怎么练')
        # AI 深度分析（有 key 时）；失败回退规则话术
        text = ai_analyze(api_key, sid, item, evs) if api_key else None
        if not text:
            text = item['good'] if pct >= 40 else item['bad']
        result.append({'key': item['key'], 'name': item['name'], 'icon': item['icon'],
                       'pct': pct, 'level': level, 'tip': tip, 'text': text})
    return result


def main():
    sleep = 30
    if len(sys.argv) > 1 and sys.argv[1] == '--sleep':
        sleep = float(sys.argv[2])
    api_key = load_api_key()
    if api_key:
        print('[water] DeepSeek AI 深度解析已启用')
    else:
        print('[water] 未配置 API key，使用规则分析（设 DEEPSEEK_API_KEY 或写 .deepseek_key）')
    print('[water] 学习水位分析服务启动，每 %ss 分析一次' % sleep)
    while True:
        try:
            events = load_events()
            by_sid = {}
            for e in events:
                sid = e.get('sid') or 'anonymous'
                if sid == 'teacher':
                    continue
                by_sid.setdefault(sid, []).append(e)
            out = {}
            for sid, evs in by_sid.items():
                out[sid] = {'ts': int(time.time() * 1000), 'items': analyze_student(sid, evs, api_key)}
            tmp = OUT_FILE + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'updated': int(time.time() * 1000), 'students': out}, f, ensure_ascii=False)
            os.replace(tmp, OUT_FILE)
            print('[water] 已分析 %d 名学生，写入 %s' % (len(out), OUT_FILE))
        except Exception as ex:
            print('[water] 出错（静默继续）: %s' % ex, file=sys.stderr)
        time.sleep(sleep)


if __name__ == '__main__':
    main()
