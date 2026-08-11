/* ============ 第一课作品 · 答疑闯关游戏 ============
   这里是「课程资料」—— 学员动手改这个文件，就是「整理资料 / 限定知识范围」。
   改法：
   1. scope：你资料涉及的关键词（边界测试用：问题里出现这些词 = 资料内）
   2. questions：你的题库（问题 / 选项 / 正确答案索引 / 依据）
   依据（basis）是关键：AI 回答必须带依据，这就是「有依据地回答」。 */

const LESSON_DATA = {
  title: 'Python 入门 · 课程资料',
  intro: '这是示例资料。把它替换成你自己的课程资料：\n① 改 scope 关键词，② 填 questions 题库，③ 每道题写清依据。',

  // 资料范围关键词：问题命中任一关键词 → 判定为"资料内问题"
  scope: ['Python', '变量', '循环', '函数', '列表', '字典', 'print', 'if', 'for', 'while', 'def'],

  // 题库：q 题目 / options 四个选项 / answer 正确选项索引(0-3) / basis 回答依据
  questions: [
    {
      q: 'Python 中 print() 的作用是什么？',
      options: ['把内容输出到屏幕', '从键盘输入内容', '删除一个文件', '创建一个新变量'],
      answer: 0,
      basis: '资料第 2 节：print() 用于把内容输出到控制台（屏幕）。'
    },
    {
      q: '下面哪个是合法的变量名？',
      options: ['1abc', 'my_var', 'my-var', 'class'],
      answer: 1,
      basis: '资料第 3 节：变量名以字母/下划线开头，不能含空格和连字符，不能用关键字（class 是关键字）。'
    },
    {
      q: 'for 循环通常配合哪个关键字遍历列表？',
      options: ['while', 'def', 'in', 'import'],
      answer: 2,
      basis: '资料第 5 节：for x in 列表: 是遍历列表的标准写法，in 用来取元素。'
    },
    {
      q: 'Python 中定义函数使用的关键字是？',
      options: ['func', 'define', 'def', 'function'],
      answer: 2,
      basis: '资料第 6 节：用 def 关键字定义函数，格式为 def 函数名():'
    },
    {
      q: '列表 my_list = [1,2,3]，my_list[0] 的值是？',
      options: ['1', '2', '3', '报错'],
      answer: 0,
      basis: '资料第 4 节：列表索引从 0 开始，所以 my_list[0] 是第一个元素 1。'
    },
    {
      q: 'if 语句后面跟的条件表达式，下面哪种写法正确？',
      options: ['if x == 1:', 'if x = 1:', 'if x == 1', 'if x.等于(1)'],
      answer: 0,
      basis: '资料第 5 节：if 条件用 == 判断相等，且末尾必须有冒号。'
    }
  ]
};
