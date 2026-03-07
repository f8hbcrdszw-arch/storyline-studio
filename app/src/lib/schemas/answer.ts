import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Answer value schemas by question type
// ─────────────────────────────────────────────────────────────────────────────

const listAnswer = z.object({
  selected: z.array(z.string().max(500)).min(1).max(100),
});

const likertAnswer = z.object({
  value: z.number().int().min(1).max(11),
});

const multiLikertAnswer = z.object({
  values: z.record(z.string(), z.number().int().min(1).max(11)),
});

const numericAnswer = z.object({
  value: z.number(),
});

const writeInAnswer = z.object({
  text: z.string().min(1).max(5000),
});

const abAnswer = z.object({
  selected: z.string().max(500),
  annotation: z.string().max(2000).optional(),
});

const rankingAnswer = z.object({
  ranked: z.array(z.string().max(500)).min(1).max(100),
});

const gridAnswer = z.object({
  values: z.record(z.string(), z.string()),
});

const comparisonAnswer = z.object({
  values: z.record(z.string(), z.string()),
});

const adMockUpAnswer = z.object({
  positive: z.array(z.string().max(500)),
  negative: z.array(z.string().max(500)),
  posAnnotation: z.string().max(2000).optional(),
  negAnnotation: z.string().max(2000).optional(),
});

const overallReactionAnswer = z.object({
  rating: z.number().int().min(1).max(11),
  selected: z.array(z.string().max(500)),
  annotation: z.string().max(2000).optional(),
});

const selectFromSetAnswer = z.object({
  selected: z.record(z.string(), z.string()),
});

const multiAdAnswer = z.object({
  selected: z.record(z.string(), z.array(z.string().max(500))),
});

const creativeCopyAnswer = z.object({
  annotations: z.array(z.string().max(2000)),
});

const videoDialAnswer = z.object({
  feedback: z.record(z.string(), z.number().min(0).max(100)),
  lightbulbs: z.array(z.number().min(0)),
  actions: z.record(z.string(), z.array(z.number().min(0))).optional(),
  annotations: z.array(z.string().max(2000)).optional(),
  sliderInteracted: z.boolean(),
});

/** Map question type → answer value schema */
export const answerSchemaByType: Record<string, z.ZodType> = {
  STANDARD_LIST: listAnswer,
  WORD_LIST: listAnswer,
  IMAGE_LIST: listAnswer,
  LIKERT: likertAnswer,
  MULTI_LIKERT: multiLikertAnswer,
  NUMERIC: numericAnswer,
  WRITE_IN: writeInAnswer,
  CREATIVE_COPY: creativeCopyAnswer,
  TEXT_AB: abAnswer,
  IMAGE_AB: abAnswer,
  GRID: gridAnswer,
  COMPARISON: comparisonAnswer,
  AD_MOCK_UP: adMockUpAnswer,
  OVERALL_REACTION: overallReactionAnswer,
  SELECT_FROM_SET: selectFromSetAnswer,
  MULTI_AD: multiAdAnswer,
  LIST_RANKING: rankingAnswer,
  VIDEO_DIAL: videoDialAnswer,
};

// ─────────────────────────────────────────────────────────────────────────────
// API request schemas
// ─────────────────────────────────────────────────────────────────────────────

export const submitAnswerSchema = z.object({
  responseId: z.string().uuid(),
  questionId: z.string().uuid(),
  value: z.record(z.string(), z.unknown()),
});

export const createResponseSchema = z.object({
  studyId: z.string().uuid(),
});
