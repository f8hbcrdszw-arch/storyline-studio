import type { ComponentType } from "react";
import type { ConfigProps } from "./types";
import { MultipleChoiceConfig } from "./MultipleChoiceConfig";
import { LikertConfig } from "./LikertConfig";
import { NumericConfig } from "./NumericConfig";
import { MatrixConfig } from "./MatrixConfig";
import { SentimentConfig } from "./SentimentConfig";
import { VideoDialConfig } from "./VideoDialConfig";

export type { ConfigProps } from "./types";

/**
 * Config component registry — maps question type to its config editor.
 * Adding a new question type without updating this registry will produce
 * a TypeScript error (exhaustiveness via Record<QuestionType, ...>).
 *
 * Types with `null` have no type-specific config (they use the common
 * fields: title, prompt, phase, required, isScreening, options).
 */
export const CONFIG_COMPONENTS: Record<string, ComponentType<ConfigProps> | null> = {
  MULTIPLE_CHOICE: MultipleChoiceConfig,
  LIKERT: LikertConfig,
  MULTI_ITEM_RATING: LikertConfig,
  REACTION: LikertConfig,
  NUMERIC: NumericConfig,
  MATRIX: MatrixConfig,
  SENTIMENT: SentimentConfig,
  VIDEO_DIAL: VideoDialConfig,
  // These types have no additional config beyond common fields
  OPEN_TEXT: null,
  AB_TEST: null,
  RANKING: null,
};
