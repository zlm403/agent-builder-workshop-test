// （一人公司）纯配置：仅含类型与常量，不依赖任何 Node/服务端模块，
// 因此可安全被客户端组件（'use client'）与服务端代码共同 import。
// 真正的运行时逻辑（跑 LLM、读写 DB、推 SSE）放在 @/lib/finale 与 @/lib/classroom。

// ============ 公司类型 ============

export type CompanyTypeKey = 'study' | 'shop' | 'fun';

export interface CompanyType {
  key: CompanyTypeKey;
  name: string;
  icon: string;
  desc: string;
  specialists: string[]; // 专家岗位池
  skills: Record<string, string[]>; // 岗位 → 技能列表
}

export const COMPANIES: Record<CompanyTypeKey, CompanyType> = {
  study: {
    key: 'study',
    name: 'AI学习中心',
    icon: '📚',
    desc: '帮助别人学习、答疑、批改和备考',
    specialists: ['英语老师', '数学老师', '物理老师', '化学老师', '作文老师', '考研规划师'],
    skills: {
      '英语老师': ['语法诊断', '作文批改', '单词记忆', '口语陪练'],
      '数学老师': ['公式讲解', '解题陪练', '错因定位', '举一反三'],
      '物理老师': ['受力分析', '概念讲解', '实验分析', '错题诊断'],
      '化学老师': ['方程式教学', '实验分析', '知识记忆', '错题诊断'],
      '作文老师': ['审题立意', '结构设计', '开头优化', '语言润色'],
      '考研规划师': ['院校选择', '时间规划', '复习策略', '心态疏导'],
    },
  },
  shop: {
    key: 'shop',
    name: 'AI好物店',
    icon: '🛍',
    desc: '帮助别人挑商品、做搭配、选礼物',
    specialists: ['数码顾问', '穿搭顾问', '护肤顾问', '礼物顾问', '美食顾问', '省钱顾问'],
    skills: {
      '数码顾问': ['参数对比', '预算推荐', '避坑检查', '场景匹配'],
      '穿搭顾问': ['通勤搭配', '约会搭配', '显瘦搭配', '色彩搭配'],
      '护肤顾问': ['肤质分析', '成分解读', '预算搭配', '使用顺序'],
      '礼物顾问': ['对象匹配', '兴趣匹配', '预算推荐', '惊喜设计'],
      '美食顾问': ['聚餐推荐', '一人食', '低预算美食', '地方特色'],
      '省钱顾问': ['比价技巧', '优惠券', '平替推荐', '囤货策略'],
    },
  },
  fun: {
    key: 'fun',
    name: 'AI娱乐社',
    icon: '🎮',
    desc: '帮助别人设计游戏、故事和聚会玩法',
    specialists: ['游戏策划师', '故事编剧', '猜谜主持人', '聚会策划师', '角色扮演搭子', '旅行玩乐顾问'],
    skills: {
      '游戏策划师': ['无道具游戏', '破冰游戏', '情侣游戏', '宿舍游戏'],
      '故事编剧': ['悬疑故事', '搞笑故事', '校园故事', '互动故事'],
      '猜谜主持人': ['海龟汤', '逻辑谜题', '脑筋急转弯', '推理问答'],
      '聚会策划师': ['生日聚会', '宿舍聚会', '社团活动', '情侣约会'],
      '角色扮演搭子': ['古风角色', '悬疑角色', '动漫角色', '原创角色'],
      '旅行玩乐顾问': ['周边游', '城市漫步', '夜生活', '亲子活动'],
    },
  },
};

// ============ 风格与名字 ============

export const SPECIALIST_STYLES = ['专业可靠', '亲切耐心', '幽默有趣', '简洁直接'];

export interface ReceptionistStyleOption {
  key: string; // 极速接待 / 准确接待 / 温暖接待
  s: string;
}

export const RECEPTIONIST_STYLES: ReceptionistStyleOption[] = [
  { key: '极速接待', s: '快速判断客户想买什么' },
  { key: '准确接待', s: '询问商品、预算、对象和偏好' },
  { key: '温暖接待', s: '先轻松交流，再了解需求' },
];

export const NAME_POOL = [
  '小满', '礼礼', '小数', '搭搭', '糖糖', '果果',
  '书书', '理理', '玩玩', '乐乐', '知知', '研研', '学学', '优优',
];

// ============ 学生端流程步骤 ============

export type StudentStep =
  | 'company'   // Step 0: 选公司
  | 'hire'      // Step 1-3: 招专家
  | 'dup'       // Step 4: 暴露重复
  | 'recep'     // Step 5: 招接待员
  | 'gm'        // Step 6: AI 总经理整顿
  | 'open'      // Step 7: 开业对话
  | 'share';    // Step 8: 分享卡片

// ============ 专家员工数据（学生搭建结果） ============

export interface Specialist {
  role: string;    // 岗位
  skill: string;   // 王牌技能
  style: string;   // 工作风格
  name: string;    // AI 生成名字
}

export interface Receptionist {
  role: string;           // '统一接待员'
  style: string;          // 接待风格
  styleDesc: string;      // 风格描述
  routes: string[];       // 认识的专家岗位列表
  name: string;           // 名字（如 '小迎'）
}

// ============ 大屏讲解态幻灯片 ============

export interface ScreenSlide {
  no: string;      // "第一屏 · 个体户"
  h: string;       // 主标题
  p: string;       // 正文（支持 HTML）
  org: Array<{ t: string; ico: string; cls: string }>; // 组织节点
}

export const SCREEN_SLIDES: ScreenSlide[] = [
  {
    no: '第一屏 · 个体户',
    h: '你已经有了一名全能员工',
    p: '第二关你造的那个员工，<span class="hl">一个人干完整个流程</span>：接待 → 诊断 → 服务 → 检查。他不需要休息，能独立接单、独立交付。',
    org: [{ t: '全能员工', ico: '🧑‍💼', cls: 'spec' }],
  },
  {
    no: '第二屏 · 复制扩张',
    h: '把成功模式复制成一支团队',
    p: '既然英语老师能这么干，物理、化学、语文、数码、穿搭……<span class="hl">复制出去，每人管一摊</span>。你不再是 1 个员工，而是一支专业团队。',
    org: [
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
    ],
  },
  {
    no: '第三屏 · 暴露重复',
    h: '可是，每个人都在重复接待',
    p: '公司大了才发现：8 个老师都要自己接待、自己分诊。<span class="hl2">重复劳动把专业时间全吞了</span>。这是公司长大后的第一个病。',
    org: [
      { t: '接待中', ico: '⚠', cls: 'warn' },
      { t: '接待中', ico: '⚠', cls: 'warn' },
      { t: '接待中', ico: '⚠', cls: 'warn' },
    ],
  },
  {
    no: '第四屏 · 统一入口 = 公司',
    h: '抽一个前台，公司才真正成型',
    p: '单独请一个<span class="hl2">统一接待员</span>，听懂需求再自动分流给对的专家。多个专业员工 + 一个前台 = <span class="hl">一家会协作的公司</span>。<br><br>今天，你们每个人都会亲手搭一家这样的公司，再让它真接一单、真收一笔钱。',
    org: [
      { t: '统一接待', ico: '🤝', cls: 'recep' },
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
      { t: '专业员工', ico: '🧑‍💼', cls: 'spec' },
    ],
  },
];

// ============ 大屏作战态漏斗阶段 ============

export const FUNNEL_STAGES = [
  { key: 'chosen', label: '已选公司' },
  { key: 'team', label: '招满 3 名专家' },
  { key: 'dup', label: '发现重复工作' },
  { key: 'recep', label: '加好前台' },
  { key: 'open', label: '已开业收款' },
] as const;

// ============ GM 检查清单 ============

export const GM_CHECKLIST = [
  '检查员工职责是否重复',
  '检查每位员工能力是否清晰',
  '检查接待员是否认识所有员工',
  '检查客户能否被正确分流',
  '检查无合适员工时如何处理',
  '检查员工之间的交接信息',
];

// ============ 兼容旧接口的常量（保留避免破坏其他引用） ============

export type FinaleAgent = {
  role: string;
  nickname: string;
  personality: string;
  duty: string;
  boundary: string;
  rules: string;
  handoff: string;
};

export const SCENE_LABEL: Record<string, string> = {
  study: '学习辅导',
  shopping: '购物推荐',
  fun: '吃喝玩乐',
};

export const SCENE_ICON: Record<string, string> = {
  study: '🏫',
  shopping: '🛒',
  fun: '🎉',
};
