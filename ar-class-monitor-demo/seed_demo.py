# -*- coding: utf-8 -*-
"""
seed_demo.py — 重灌演示数据（一核多表棱镜版）
=================================================
保留：与「老大」的对话记录（agent_dialog_req/resp，演示顷悟链路）
替换：demo_zhang / demo_li / demo_wang 三名学员的作品事件轨迹，
      全部换成「完整事件链 + 中文原文」，喂饱四课各自的棱镜表：
        pre 语言棱镜 ← express_submit.idea 原文
        t1  边界棱镜 ← game_start/question_answered/game_over/boundary_test
        t2  规则棱镜 ← tool_submit(6项)/tool_check/tool_result/tool_error
        t3  系统棱镜 ← goal_submit/abilities_generated/employee_configured/
                        tool_selected/handoff_designed/test_message/published

三人对比设计：
  demo_zhang  完整型 —— 每课都做到位，棱镜基本立住（分数高）
  demo_li     极薄型 —— 表达极模糊、不测边界、字段不全、综合课放弃（分数低）
  demo_wang   中间型 —— 半吊子：部分做到、部分放弃（班级热力橙色的来源）
直接写 agent-live/events.jsonl，不依赖服务是否在跑。
"""
import io
import json
import os
import shutil

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'agent-live', 'events.jsonl')

T0 = 1786091000000  # 新学生事件时间起点（晚于对话记录）

EVENTS = [
    # ============ demo_zhang：完整型 ============
    # -- 预备课：表达完整（对象/场景/问题/任务/目标/标准/互动/输出 8 格）
    {'sid': 'demo_zhang', 'event': 'page_loaded', 'payload': {'course': '0', 'page': 'warmup'}},
    {'sid': 'demo_zhang', 'event': 'express_submit', 'payload': {'course': '0', 'idea': '给大学同学做一个背单词打卡的小程序，每天10分钟，解决他们记不住单词的问题，打卡满30天算成功，每天完成后输出打卡记录卡片'}},
    {'sid': 'demo_zhang', 'event': 'ai_analyzed', 'payload': {'course': '0', 'len': 240}},
    {'sid': 'demo_zhang', 'event': 'confirm_opened', 'payload': {'course': '0', 'parsed': True}},
    {'sid': 'demo_zhang', 'event': 'polished', 'payload': {'course': '0'}},
    # -- 第一课：有依据回答 + 主动测边界（资料内/外各 1 次）
    {'sid': 'demo_zhang', 'event': 'page_loaded', 'payload': {'course': '1', 'page': 'game'}},
    {'sid': 'demo_zhang', 'event': 'game_start', 'payload': {'course': '1', 'total': 5}},
    {'sid': 'demo_zhang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': True, 'score': 20}},
    {'sid': 'demo_zhang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': True, 'score': 20}},
    {'sid': 'demo_zhang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': False, 'score': 20}},
    {'sid': 'demo_zhang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': True, 'score': 20}},
    {'sid': 'demo_zhang', 'event': 'game_over', 'payload': {'course': '1', 'score': 80, 'correct': 4, 'total': 5}},
    {'sid': 'demo_zhang', 'event': 'boundary_test', 'payload': {'course': '1', 'inScope': True, 'question': '课程资料里 Python 的列表是什么？'}},
    {'sid': 'demo_zhang', 'event': 'boundary_test', 'payload': {'course': '1', 'inScope': False, 'question': '明天天气怎么样？'}},
    # -- 第二课：6 项输入齐全 + 规则校验触发 + 异常测试
    {'sid': 'demo_zhang', 'event': 'page_loaded', 'payload': {'course': '2', 'page': 'tool'}},
    {'sid': 'demo_zhang', 'event': 'tool_submit', 'payload': {'course': '2', 'theme': '迎新晚会', 'people': 300, 'venue': '报告厅', 'budget': 5000, 'date': '下周五', 'duration': '2小时'}},
    {'sid': 'demo_zhang', 'event': 'tool_check', 'payload': {'course': '2', 'ok': False}},
    {'sid': 'demo_zhang', 'event': 'tool_result', 'payload': {'course': '2', 'warns': 1}},
    {'sid': 'demo_zhang', 'event': 'tool_error', 'payload': {'course': '2', 'test': '预算为0'}},
    # -- 综合课：拆目标→配员工→选工具→交接→测试发布 全链
    {'sid': 'demo_zhang', 'event': 'page_loaded', 'payload': {'course': '4', 'page': 'agent-team'}},
    {'sid': 'demo_zhang', 'event': 'goal_submit', 'payload': {'course': '4', 'goal': '做一个校园迎新助手'}},
    {'sid': 'demo_zhang', 'event': 'abilities_generated', 'payload': {'course': '4'}},
    {'sid': 'demo_zhang', 'event': 'employee_configured', 'payload': {'course': '4', 'count': 4}},
    {'sid': 'demo_zhang', 'event': 'tool_selected', 'payload': {'course': '4', 'on': True}},
    {'sid': 'demo_zhang', 'event': 'tool_selected', 'payload': {'course': '4', 'on': True}},
    {'sid': 'demo_zhang', 'event': 'tool_selected', 'payload': {'course': '4', 'on': True}},
    {'sid': 'demo_zhang', 'event': 'handoff_designed', 'payload': {'course': '4', 'count': 3}},
    {'sid': 'demo_zhang', 'event': 'test_message', 'payload': {'course': '4'}},
    {'sid': 'demo_zhang', 'event': 'published', 'payload': {'course': '4', 'staffs': 4, 'handoffs': 3}},

    # ============ demo_li：极薄型 ============
    # -- 预备课：一句话极模糊（只命中“帮我”任务格）
    {'sid': 'demo_li', 'event': 'page_loaded', 'payload': {'course': '0', 'page': 'warmup'}},
    {'sid': 'demo_li', 'event': 'express_submit', 'payload': {'course': '0', 'idea': '帮我弄个东西'}},
    # -- 第一课：答题一半对一半错，不测边界
    {'sid': 'demo_li', 'event': 'page_loaded', 'payload': {'course': '1', 'page': 'game'}},
    {'sid': 'demo_li', 'event': 'game_start', 'payload': {'course': '1', 'total': 5}},
    {'sid': 'demo_li', 'event': 'question_answered', 'payload': {'course': '1', 'correct': True, 'score': 20}},
    {'sid': 'demo_li', 'event': 'question_answered', 'payload': {'course': '1', 'correct': False, 'score': 20}},
    {'sid': 'demo_li', 'event': 'game_over', 'payload': {'course': '1', 'score': 40, 'correct': 2, 'total': 5}},
    # -- 第二课：只填 2 项输入，不检查不生成，只做了个异常测试
    {'sid': 'demo_li', 'event': 'page_loaded', 'payload': {'course': '2', 'page': 'tool'}},
    {'sid': 'demo_li', 'event': 'tool_submit', 'payload': {'course': '2', 'theme': '读书会', 'people': 40, 'budget': 200}},
    {'sid': 'demo_li', 'event': 'tool_error', 'payload': {'course': '2', 'test': '人数为负数'}},
    # -- 综合课：只写目标就放弃
    {'sid': 'demo_li', 'event': 'page_loaded', 'payload': {'course': '4', 'page': 'agent-team'}},
    {'sid': 'demo_li', 'event': 'goal_submit', 'payload': {'course': '4', 'goal': '做个迎新系统'}},

    # ============ demo_wang：中间型 ============
    # -- 预备课：表达模糊（对象是泛人群、目标愿望型、其余空缺）
    {'sid': 'demo_wang', 'event': 'page_loaded', 'payload': {'course': '0', 'page': 'warmup'}},
    {'sid': 'demo_wang', 'event': 'express_submit', 'payload': {'course': '0', 'idea': '想做个提高大家学习兴趣的小工具'}},
    {'sid': 'demo_wang', 'event': 'ai_analyzed', 'payload': {'course': '0', 'len': 120}},
    {'sid': 'demo_wang', 'event': 'confirm_opened', 'payload': {'course': '0', 'parsed': True}},
    # -- 第一课：答一半对，只测了 1 次资料外问题
    {'sid': 'demo_wang', 'event': 'page_loaded', 'payload': {'course': '1', 'page': 'game'}},
    {'sid': 'demo_wang', 'event': 'game_start', 'payload': {'course': '1', 'total': 5}},
    {'sid': 'demo_wang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': True, 'score': 20}},
    {'sid': 'demo_wang', 'event': 'question_answered', 'payload': {'course': '1', 'correct': False, 'score': 20}},
    {'sid': 'demo_wang', 'event': 'game_over', 'payload': {'course': '1', 'score': 40, 'correct': 2, 'total': 5}},
    {'sid': 'demo_wang', 'event': 'boundary_test', 'payload': {'course': '1', 'inScope': False, 'question': '今天吃什么好？'}},
    # -- 第二课：填 4 项输入，不检查不生成不测异常
    {'sid': 'demo_wang', 'event': 'page_loaded', 'payload': {'course': '2', 'page': 'tool'}},
    {'sid': 'demo_wang', 'event': 'tool_submit', 'payload': {'course': '2', 'theme': '班级旅行', 'people': 20, 'venue': '郊区', 'budget': 800}},
    # -- 综合课：拆目标+配员工，不选工具不交接不发布
    {'sid': 'demo_wang', 'event': 'page_loaded', 'payload': {'course': '4', 'page': 'agent-team'}},
    {'sid': 'demo_wang', 'event': 'goal_submit', 'payload': {'course': '4', 'goal': '做一个班级事务助手'}},
    {'sid': 'demo_wang', 'event': 'abilities_generated', 'payload': {'course': '4'}},
    {'sid': 'demo_wang', 'event': 'employee_configured', 'payload': {'course': '4', 'count': 3}},
]


def main():
    # 1) 备份当前数据
    if os.path.exists(DATA):
        shutil.copy2(DATA, DATA + '.bak')
    # 2) 保留与「老大」的对话记录
    keep = []
    if os.path.exists(DATA):
        with io.open(DATA, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if isinstance(e, dict) and e.get('sid') == '老大':
                    keep.append(e)
    # 3) 组装新学生事件（ts 递增）
    rows = list(keep)
    for i, e in enumerate(EVENTS):
        rows.append({'ts': T0 + i * 1000, 'sid': e['sid'], 'event': e['event'], 'payload': e['payload']})
    # 4) 写回
    with io.open(DATA, 'w', encoding='utf-8') as f:
        for e in rows:
            f.write(json.dumps(e, ensure_ascii=False) + '\n')
    print('KEEP_DIALOG=%d  STUDENT_EVENTS=%d  TOTAL=%d' % (len(keep), len(EVENTS), len(rows)))
    from collections import Counter
    print('BY_SID:', dict(Counter(e['sid'] for e in rows)))
    print('BY_EVENT:', dict(Counter(e['event'] for e in rows)))


if __name__ == '__main__':
    main()
