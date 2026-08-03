// 课程模块配置类型（配置驱动，不硬编码页面顺序）

export type ModuleType =
  | 'waiting'
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
  | 'persona_config'; // A11：一人一配置（桥接终章·多 Agent）

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
  kind: 'student_profile' | 'recent_issues' | 'reading_material' | 'other';
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
