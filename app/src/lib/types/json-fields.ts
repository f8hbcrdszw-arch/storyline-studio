// ─────────────────────────────────────────────────────────────────────────────
// TypeScript types for Prisma JSONB fields
// These provide type safety for the polymorphic JSON columns in the schema.
// Use these types when reading/writing JSONB fields instead of raw `any`.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Study.settings
// ─────────────────────────────────────────────────────────────────────────────

export interface StudySettings {
  allowBackNavigation?: boolean;
  showProgress?: boolean;
  completionRedirectUrl?: string;
  quota?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Question.config — varies by QuestionType
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionConfig {
  minSelect?: number;
  maxSelect?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  rows?: { id: string; label: string }[];
  columns?: { id: string; label: string }[];
  sets?: { id: string; label: string; options: string[] }[];
  likertScale?: number;
  likertLabels?: { low: string; high: string };
  randomizeOptions?: boolean;
  allowAnnotation?: boolean;
  maxAnnotationLength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Question.skipLogic
// ─────────────────────────────────────────────────────────────────────────────

export interface SkipLogicRule {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "gt" | "lt";
  value: string | number | string[];
  skipToQuestionId?: string;
  screenOut?: boolean;
}

export type SkipLogic = SkipLogicRule[];

// ─────────────────────────────────────────────────────────────────────────────
// Response.metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface ResponseMetadata {
  userAgent?: string;
  ipHash?: string;
  referrer?: string;
  screenWidth?: number;
  screenHeight?: number;
  fingerprintId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer.value — discriminated by QuestionType
// ─────────────────────────────────────────────────────────────────────────────

export interface VideoDialAnswerValue {
  feedback: Record<number, number>;
  lightbulbs: number[];
  actions?: Record<string, number[]>;
  annotations?: string[];
  sliderInteracted: boolean;
}

export interface ListAnswerValue {
  selected: string[];
}

export interface LikertAnswerValue {
  value: number;
}

export interface MultiLikertAnswerValue {
  values: Record<string, number>;
}

export interface NumericAnswerValue {
  value: number;
}

export interface WriteInAnswerValue {
  text: string;
}

export interface ABAnswerValue {
  selected: string;
  annotation?: string;
}

export interface RankingAnswerValue {
  ranked: string[];
}

export interface GridAnswerValue {
  values: Record<string, string>;
}

export interface ComparisonAnswerValue {
  values: Record<string, string>;
}

export interface AdMockUpAnswerValue {
  positive: string[];
  negative: string[];
  posAnnotation?: string;
  negAnnotation?: string;
}

export interface OverallReactionAnswerValue {
  rating: number;
  selected: string[];
  annotation?: string;
}

export interface SelectFromSetAnswerValue {
  selected: Record<string, string>;
}

export interface MultiAdAnswerValue {
  selected: Record<string, string[]>;
}

export interface CreativeCopyAnswerValue {
  annotations: string[];
}

export type AnswerValue =
  | VideoDialAnswerValue
  | ListAnswerValue
  | LikertAnswerValue
  | MultiLikertAnswerValue
  | NumericAnswerValue
  | WriteInAnswerValue
  | ABAnswerValue
  | RankingAnswerValue
  | GridAnswerValue
  | ComparisonAnswerValue
  | AdMockUpAnswerValue
  | OverallReactionAnswerValue
  | SelectFromSetAnswerValue
  | MultiAdAnswerValue
  | CreativeCopyAnswerValue;

// ─────────────────────────────────────────────────────────────────────────────
// ExportJob.config
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportJobConfig {
  segmentFilters?: {
    questionId: string;
    values: string[];
  }[];
  includeScreenedOut?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}
