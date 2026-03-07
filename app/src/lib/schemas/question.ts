import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Question type enum (matches Prisma enum)
// ─────────────────────────────────────────────────────────────────────────────

export const questionTypeEnum = z.enum([
  "VIDEO_DIAL",
  "STANDARD_LIST",
  "WORD_LIST",
  "IMAGE_LIST",
  "LIKERT",
  "MULTI_LIKERT",
  "NUMERIC",
  "WRITE_IN",
  "TEXT_AB",
  "IMAGE_AB",
  "LIST_RANKING",
  "GRID",
  "COMPARISON",
  "AD_MOCK_UP",
  "OVERALL_REACTION",
  "SELECT_FROM_SET",
  "MULTI_AD",
  "CREATIVE_COPY",
]);

export const questionPhaseEnum = z.enum([
  "SCREENING",
  "PRE_BALLOT",
  "STIMULUS",
  "POST_BALLOT",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Question config schemas per type
// ─────────────────────────────────────────────────────────────────────────────

const rowColumnItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
});

const setItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
  options: z.array(z.string()).min(1),
});

const baseListConfig = z.object({
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  randomizeOptions: z.boolean().optional(),
});

const likertConfig = z.object({
  likertScale: z.number().int().min(3).max(11).default(7),
  likertLabels: z
    .object({ low: z.string().max(100), high: z.string().max(100) })
    .optional(),
});

const multiLikertConfig = likertConfig.extend({
  rows: z.array(rowColumnItem).min(1).max(50),
});

const numericConfig = z.object({
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().positive().optional(),
});

const gridConfig = z.object({
  rows: z.array(rowColumnItem).min(1).max(50),
  columns: z.array(rowColumnItem).min(2).max(20),
});

const comparisonConfig = z.object({
  rows: z.array(rowColumnItem).min(1).max(50),
});

const abConfig = z.object({
  allowAnnotation: z.boolean().optional(),
  maxAnnotationLength: z.number().int().max(5000).optional(),
});

const adMockUpConfig = z.object({
  allowAnnotation: z.boolean().optional(),
  maxAnnotationLength: z.number().int().max(5000).optional(),
  maxPositive: z.number().int().min(1).optional(),
  maxNegative: z.number().int().min(1).optional(),
});

const overallReactionConfig = z.object({
  likertScale: z.number().int().min(3).max(11).default(10),
  likertLabels: z
    .object({ low: z.string().max(100), high: z.string().max(100) })
    .optional(),
  allowAnnotation: z.boolean().optional(),
  maxSelect: z.number().int().min(1).optional(),
});

const selectFromSetConfig = z.object({
  sets: z.array(setItem).min(1).max(20),
});

const multiAdConfig = z.object({
  sets: z.array(setItem).min(1).max(20),
  maxSelect: z.number().int().min(1).optional(),
});

const videoDialConfig = z.object({
  mode: z.enum(["intensity", "sentiment"]).default("intensity"),
  actionButtons: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(50),
        icon: z.string().max(50).optional(),
      })
    )
    .max(4)
    .optional(),
});

const writeInConfig = z.object({
  maxLength: z.number().int().max(10000).optional(),
  placeholder: z.string().max(500).optional(),
});

const creativeCopyConfig = z.object({
  maxAnnotationLength: z.number().int().max(5000).optional(),
});

const listRankingConfig = z.object({
  maxRank: z.number().int().min(1).optional(),
});

// General config schema — accepts any valid config
// Use record to satisfy Prisma's InputJsonValue type
export const questionConfigSchema = z.record(z.string(), z.unknown());

// ─────────────────────────────────────────────────────────────────────────────
// Config validator per question type
// ─────────────────────────────────────────────────────────────────────────────

export const configSchemaByType: Record<string, z.ZodType> = {
  STANDARD_LIST: baseListConfig,
  WORD_LIST: baseListConfig,
  IMAGE_LIST: baseListConfig,
  LIKERT: likertConfig,
  MULTI_LIKERT: multiLikertConfig,
  NUMERIC: numericConfig,
  WRITE_IN: writeInConfig,
  CREATIVE_COPY: creativeCopyConfig,
  TEXT_AB: abConfig,
  IMAGE_AB: abConfig,
  GRID: gridConfig,
  COMPARISON: comparisonConfig,
  AD_MOCK_UP: adMockUpConfig,
  OVERALL_REACTION: overallReactionConfig,
  SELECT_FROM_SET: selectFromSetConfig,
  MULTI_AD: multiAdConfig,
  LIST_RANKING: listRankingConfig,
  VIDEO_DIAL: videoDialConfig,
};

// ─────────────────────────────────────────────────────────────────────────────
// Skip logic schema
// ─────────────────────────────────────────────────────────────────────────────

export const skipLogicRuleSchema = z.object({
  questionId: z.string().uuid(),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "gt",
    "lt",
  ]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  skipToQuestionId: z.string().uuid().optional(),
  screenOut: z.boolean().optional(),
});

export const skipLogicSchema = z.array(skipLogicRuleSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Question option schema
// ─────────────────────────────────────────────────────────────────────────────

export const questionOptionSchema = z.object({
  label: z.string().min(1).max(500),
  value: z.string().min(1).max(255),
  order: z.number().int().min(0),
  imageUrl: z.string().url().max(2000).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Create / Update question schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createQuestionSchema = z.object({
  studyId: z.string().uuid(),
  phase: questionPhaseEnum,
  type: questionTypeEnum,
  title: z.string().min(1).max(500),
  prompt: z.string().max(5000).optional(),
  config: questionConfigSchema.optional(),
  required: z.boolean().optional(),
  isScreening: z.boolean().optional(),
  skipLogic: skipLogicSchema.optional(),
  options: z.array(questionOptionSchema).optional(),
});

export const updateQuestionSchema = z.object({
  phase: questionPhaseEnum.optional(),
  title: z.string().min(1).max(500).optional(),
  prompt: z.string().max(5000).optional().nullable(),
  config: questionConfigSchema.optional(),
  required: z.boolean().optional(),
  isScreening: z.boolean().optional(),
  skipLogic: skipLogicSchema.optional().nullable(),
});

export const reorderQuestionsSchema = z.object({
  studyId: z.string().uuid(),
  questionIds: z.array(z.string().uuid()).min(1),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
