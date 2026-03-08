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
  theme?: SurveyTheme;
  thankYouHeading?: string;
  thankYouBody?: string;
  thankYouCtaLabel?: string;
  thankYouCtaUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Survey theme — per-study visual customization
// ─────────────────────────────────────────────────────────────────────────────

export interface SurveyTheme {
  primaryColor: string;       // hex, default: #121C8A (Storyline Blue)
  backgroundColor: string;    // hex, default: #F4F3EF (Cream)
  textColor: string;          // hex, default: #100C21 (Navy)
  accentColor: string;        // hex, default: #121C8A
  buttonStyle: "rounded" | "pill" | "square";
  progressBarStyle: "line" | "dots" | "fraction" | "hidden";
}

export const DEFAULT_THEME: SurveyTheme = {
  primaryColor: "#121C8A",
  backgroundColor: "#F4F3EF",
  textColor: "#100C21",
  accentColor: "#121C8A",
  buttonStyle: "rounded",
  progressBarStyle: "line",
};

/** Preset themes */
export const THEME_PRESETS: Record<string, SurveyTheme> = {
  "Storyline Classic": { ...DEFAULT_THEME },
  "Minimal Light": {
    primaryColor: "#18181B",
    backgroundColor: "#FFFFFF",
    textColor: "#18181B",
    accentColor: "#18181B",
    buttonStyle: "pill",
    progressBarStyle: "line",
  },
  "Dark Professional": {
    primaryColor: "#818CF8",
    backgroundColor: "#1E1B2E",
    textColor: "#F4F3EF",
    accentColor: "#818CF8",
    buttonStyle: "rounded",
    progressBarStyle: "line",
  },
  "Corporate Blue": {
    primaryColor: "#2563EB",
    backgroundColor: "#F8FAFC",
    textColor: "#0F172A",
    accentColor: "#2563EB",
    buttonStyle: "square",
    progressBarStyle: "fraction",
  },
};

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
  // Video dial specific
  mode?: "intensity" | "sentiment";
  actionButtons?: { id: string; label: string; icon?: string }[];
  showAnnotation?: boolean;
  annotationPrompt?: string;
  annotationPlaceholder?: string;
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
  feedback: Record<string, number>;
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
