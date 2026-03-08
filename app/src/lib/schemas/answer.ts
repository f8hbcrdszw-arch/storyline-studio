import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Answer value schemas by question type
// ─────────────────────────────────────────────────────────────────────────────

const multipleChoiceAnswer = z.object({
  selected: z.array(z.string().max(500)).min(1).max(100),
});

const likertAnswer = z.object({
  value: z.number().int().min(1).max(11),
});

const openTextAnswer = z.object({
  text: z.string().min(1).max(5000),
});

const numericAnswer = z.object({
  value: z.number(),
});

const abTestAnswer = z.object({
  selected: z.string().max(500),
  annotation: z.string().max(2000).optional(),
});

const rankingAnswer = z.object({
  ranked: z.array(z.string().max(500)).min(1).max(100),
});

const matrixAnswer = z.object({
  values: z.record(z.string(), z.string()),
});

const multiItemRatingAnswer = z.object({
  values: z.record(z.string(), z.number().int().min(1).max(11)),
});

const sentimentAnswer = z.object({
  ratings: z.record(z.string(), z.array(z.string().max(500))),
  annotation: z.string().max(2000).optional(),
});

const reactionAnswer = z.object({
  rating: z.number().int().min(1).max(11),
  selected: z.array(z.string().max(500)),
  annotation: z.string().max(2000).optional(),
});

const videoDialAnswer = z.object({
  feedback: z.record(z.string(), z.number().min(0).max(100)),
  lightbulbs: z.array(z.number().min(0)),
  actions: z.record(z.string(), z.array(z.number().min(0))).optional(),
  annotations: z.array(z.string().max(2000)).optional(),
  sliderInteracted: z.boolean(),
});

import type { QuestionType } from "./question";

/** Map question type → answer value schema */
export const answerSchemaByType: Record<QuestionType, z.ZodType> = {
  VIDEO_DIAL: videoDialAnswer,
  MULTIPLE_CHOICE: multipleChoiceAnswer,
  LIKERT: likertAnswer,
  OPEN_TEXT: openTextAnswer,
  NUMERIC: numericAnswer,
  AB_TEST: abTestAnswer,
  RANKING: rankingAnswer,
  MATRIX: matrixAnswer,
  MULTI_ITEM_RATING: multiItemRatingAnswer,
  SENTIMENT: sentimentAnswer,
  REACTION: reactionAnswer,
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
  turnstileToken: z.string().optional(),
});
