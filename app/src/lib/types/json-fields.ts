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
  displayStyle?: "list" | "bubbles" | "images";
  minSelect?: number;
  maxSelect?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  rows?: { id: string; label: string }[];
  columns?: { id: string; label: string }[];
  attributes?: string[];
  maxPerAttribute?: number;
  maxRank?: number;
  likertScale?: number;
  likertLabels?: { low: string; high: string };
  randomizeOptions?: boolean;
  allowAnnotation?: boolean;
  maxAnnotationLength?: number;
  maxLength?: number;
  placeholder?: string;
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

export interface MultipleChoiceAnswerValue {
  selected: string[];
}

export interface LikertAnswerValue {
  value: number;
}

export interface OpenTextAnswerValue {
  text: string;
}

export interface NumericAnswerValue {
  value: number;
}

export interface ABTestAnswerValue {
  selected: string;
  annotation?: string;
}

export interface RankingAnswerValue {
  ranked: string[];
}

export interface MatrixAnswerValue {
  values: Record<string, string>;
}

export interface MultiItemRatingAnswerValue {
  values: Record<string, number>;
}

export interface SentimentAnswerValue {
  ratings: Record<string, string[]>;
  annotation?: string;
}

export interface ReactionAnswerValue {
  rating: number;
  selected: string[];
  annotation?: string;
}

export type AnswerValue =
  | VideoDialAnswerValue
  | MultipleChoiceAnswerValue
  | LikertAnswerValue
  | OpenTextAnswerValue
  | NumericAnswerValue
  | ABTestAnswerValue
  | RankingAnswerValue
  | MatrixAnswerValue
  | MultiItemRatingAnswerValue
  | SentimentAnswerValue
  | ReactionAnswerValue;

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
