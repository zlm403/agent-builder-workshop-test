// 课程模块配置类型（配置驱动，不硬编码页面顺序）

export type ModuleType =
  | 'waiting'
  | 'screening'
  | 'single_choice'
  | 'multi_choice'
  | 'true_false'
  | 'matching'
  | 'short_text'
  | 'source_select'
  | 'agent_config'
  | 'workflow_order'
  | 'rule_config'
  | 'stress_test'
  | 'ai_run'
  | 'result_scoring'
  | 'diagnosis'
  | 'compare_runs'
  | 'publish'
  | 'peer_review'
  | 'course_path'
  | 'enrollment'
  | 'lecture'
  | 'ai_task' // A01：真实任务 AI 工作区（基线测试）
  | 'class_mirror' // A02：全班行为镜像与复盘
  | 'hr_screening' // A0：AI 审判官 · 应聘自检（离线 mock HR，后续可接 LLM）
  | 'persona_config' // A11：一人一配置（桥接·多 Agent）
  | 'finale' // A07：一人公司·多 Agent 协同
  | 'wrap_up' // A08：一期收尾讲解（学生端提示看大屏）
  | 'l2_intro' // 第二关开场
  | 'knowledge_select' // A04：选择知识库
  | 'skill_build' // A05：编写 Skill
  | 'assistant_try' // A06：运行·检查·修改·提交
  | 'a0_new' // A0 新版：三问打字 + 关系题投票 + 揭晓（AI 与你的关系）
  | 'avatar_flow' // A1 数字分身：六步连续对话（梦想→路径→分身→任务→方案→迭代）
  | 'site_entry' // P2 快速入门网站：六步连续对话（领域→入场→骨架→判断→设计→迭代）
  | 'grow_game'; // P3 养成游戏：六步连续对话（设想→成长→规则→事件→结局→迭代）

export interface ChoiceOption {
  id: string;
  label: string;
  value?: string;
}

export interface StudentTask {
  prompt?: string;
  options?: ChoiceOption[];
  fields?: { key: string; label: string; placeholder?: string; required?: boolean }[];
  allowPaste?: boolean;
  allowExample?: boolean;
  [key: string]: unknown;
}

export interface ModuleConfig {
  id: string;
  title: string;
  type: ModuleType;
  teacherContent?: Record<string, unknown>;
  studentTask?: StudentTask;
  screenContent?: Record<string, unknown>;
  durationSeconds: number;
  requiresAI?: boolean;
  entryCondition?: string[];
  completionRule?: Record<string, unknown>;
  fallbackMode?: string;
  nextModuleId?: string;
}

export interface CourseTemplateData {
  version: string;
  name: string;
  subtitle?: string;
  modules: ModuleConfig[];
}

export type ModuleStatus =
  | 'pending'
  | 'entered'
  | 'submitted'
  | 'completed'
  | 'stuck'
  | 'skipped';

// ============ A01 真实任务 AI 工作区 ============
export interface TaskMaterial {
  id: string;
  title: string;
  body: string;
  kind: 'student_profile' | 'recent_issues' | 'reading_material' | 'vocab_bank' | 'other';
}

export interface AiTaskConfig {
  prompt: string; // 任务总述
  requirements: string[]; // 任务要求
  materials: TaskMaterial[]; // 资料区
  timeLimitSec: number; // 限时（秒）
  taskArea: {
    targetUser: string;
    goal: string;
    available: string;
    finalDeliverable: string;
  };
}

// ============ A02 全班行为镜像 ============
export interface ClassMirrorConfig {
  headline: string;
  metricLabels: {
    started: string;
    usedMaterial: string;
    iterated: string;
    verified: string;
    submitted: string;
  };
  paths: { name: string; steps: string[] }[];
  question: string;
}

// ============ A03 讲授 / 对比讲解 ============
export interface LectureConfig {
  headline: string;
  bullets: string[];
  comparison?: { bad: string; good: string };
}

// ============ 第二关：把 AI 助手交给不同的人 ============
export type GenerationMode = 'primary' | 'fast-fallback' | 'offline-example';

export type L2ModuleId = 'L2_INTRO' | 'A04_KNOWLEDGE' | 'A05_SKILL' | 'A06_TRY';

export type KnowledgeSubState = 'select' | 'ready';
export type SkillSubState = 'edit' | 'preview';
export type TrySubState =
  | 'profiles'
  | 'running-first'
  | 'first-result'
  | 'checking'
  | 'check-result'
  | 'revise-knowledge'
  | 'revise-skill'
  | 'revise-both'
  | 'running-second'
  | 'second-result'
  | 'submit'
  | 'completed';

// 双跑引用：模型必须结构化返回实际使用的 docId
export interface RunReference {
  docId: string;
  usage?: string;
  evidence?: string;
}

export interface LearnerRunResult {
  learnerId: string;
  trainingFocus: string;
  materialDifficulty: string;
  trainingTask: string;
  trainingDuration: string;
  feedbackMethod: string;
  references: RunReference[];
}

export interface DualRunResponse {
  runId: string;
  generationMode: GenerationMode;
  learnerA: LearnerRunResult;
  learnerB: LearnerRunResult;
  warnings: string[];
}

export type AiCheckDiagnosisType = 'knowledgeBase' | 'skill' | 'both' | 'acceptable';

export type SkillBlockStatus = 'good' | 'weak' | 'empty';

export interface SkillBlockEval {
  block: '了解' | '判断' | '执行' | '反馈';
  status: SkillBlockStatus;
  comment: string;
}

export interface AiCheckResult {
  overallStatus: string;
  positiveFindings: string[];
  issues: string[];
  evidence: string[];
  recommendations: string[];
  diagnosisType: AiCheckDiagnosisType;
  skillEvaluation?: SkillBlockEval[];
}

export interface SkillVersion {
  understand: string;
  judge: string;
  execute: string;
  sourcePriorityRule: string;
  feedback: string;
}

export interface L2ProcessData {
  schemaVersion: 1;
  courseId: string;
  sessionId: string;
  studentId: string;
  currentModule: L2ModuleId;
  moduleSubState: string;
  knowledgeBase: {
    initialSelection: string[];
    selectionLogs: { docId: string; action: 'add' | 'remove'; at: string }[];
    initialSnapshot: Record<string, unknown>;
    firstRunReferences: string[];
    aiDiagnosis?: Record<string, unknown>;
    finalSelection: string[];
    finalSnapshot: Record<string, unknown>;
    secondRunReferences: string[];
  };
  skill: {
    initialVersion: SkillVersion;
    phraseTokensUsed: string[];
    aiDiagnosis?: Record<string, unknown>;
    revisionLogs: { block: string; from: string; to: string; at: string }[];
    finalVersion: SkillVersion;
  };
  firstRun?: {
    learnerA: LearnerRunResult;
    learnerB: LearnerRunResult;
    generationMode: GenerationMode;
  };
  aiCheck?: AiCheckResult;
  revisions: { kind: 'knowledge' | 'skill' | 'both'; at: string }[];
  secondRun?: {
    learnerA: LearnerRunResult;
    learnerB: LearnerRunResult;
    generationMode: GenerationMode;
    comparisonWithFirstRun?: string;
  };
  interactionLogs: {
    module: string;
    subState: string;
    action: string;
    at: string;
  }[];
  submittedAt?: string;
}

// ============ A07 一人公司 · 学生搭建状态 ============

export type A07StudentPhase =
  | 'company'   // 选公司
  | 'hire'      // 招聘专家（含子阶段 role/skill/style）
  | 'dup'       // 暴露重复
  | 'recep'     // 招接待员
  | 'gm'        // AI 总经理整顿
  | 'open'      // 开业对话
  | 'share';    // 分享 + 自由体验

export type HireSubStage = 'role' | 'skill' | 'style';

export interface A07StudentState {
  phase: A07StudentPhase;
  companyKey: string | null;       // 'study' | 'shop' | 'fun'
  specialists: Array<{             // 已招专家
    role: string;
    skill: string;
    style: string;
    name: string;
  }>;
  receptionist: {                  // 接待员（招完才有）
    style: string;
    styleDesc: string;
    routes: string[];
    name: string;
  } | null;
  hireIdx: number;                 // 当前招第几名 (0-2)
  hireStage: HireSubStage;         // 招聘子阶段
  hirePick: { role: string; skill: string; style: string }; // 当前选择
  // 开业对话状态
  chatMessages: Array<{
    role: 'user' | 'recep' | 'spec';
    name: string;
    text: string;
  }>;
  chatPhase: 'recep' | 'spec' | 'done';
  chatRecepTurns: number;
  chatSpecTurns: number;
  chatSpec: { role: string; name: string } | null;
  chatFirstNeed: string;
  // 订单
  orderPrice: number;
  orderPriceStr: string;
  orderDone: boolean;
}

// ============ A07 一人公司 · 大屏状态 ============

export type A07ScreenMode = 'brief' | 'dash';

export interface A07ScreenState {
  mode: A07ScreenMode;
  briefSlideIndex: number;        // 讲解态当前幻灯片
  // 作战态数据
  totalStudents: number;
  typeCount: Record<string, number>;     // 公司类型分布
  funnel: Record<string, number>;        // 漏斗各阶段人数
  released: { dup: boolean; open: boolean }; // 阶段释放锁
  leaderboard: Array<{               // 营收排行榜
    bossName: string;
    companyName: string;
    revenue: number;
  }>;
}
