// ─────────────────────────────────────────────────────────────────────────────
// Canonical question types — single source of truth for all consumers
// Replaces duplicate types in: StudyEditor, SurveyShell, ResultsDashboard, QuestionResults
// ─────────────────────────────────────────────────────────────────────────────

import type { QuestionType } from "../schemas/question";

/** Question option as returned by the API */
export interface QuestionOptionData {
  id: string;
  label: string;
  value: string;
  order: number;
  imageUrl: string | null;
}

/** Media item as returned by the API */
export interface MediaItemData {
  id: string;
  source: string;
  url: string | null;
  youtubeId: string | null;
  filename: string | null;
  type: string;
  durationSecs: number | null;
  thumbnailUrl: string | null;
}

/** Full question with options and media — used by editor and survey */
export interface QuestionData {
  id: string;
  type: string;
  phase: string;
  order: number;
  title: string;
  prompt: string | null;
  config: Record<string, unknown>;
  required: boolean;
  isScreening: boolean;
  skipLogic: Record<string, unknown>[] | null;
  options: QuestionOptionData[];
  mediaItems: MediaItemData[];
}

/** Lighter projection for results views (no skipLogic, no required, no config) */
export interface QuestionInfo {
  id: string;
  title: string;
  type: string;
  phase: string;
  order: number;
  isScreening: boolean;
  options: { id: string; label: string; value: string }[];
  mediaItems: { id: string; source: string; youtubeId: string | null; url: string | null }[];
}
