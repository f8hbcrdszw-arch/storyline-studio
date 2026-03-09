/**
 * Shared editor constants — single source of truth for labels and colors
 * used across QuestionList, SortableQuestion, PreviewShell, and study pages.
 */

export const TYPE_LABELS: Record<string, string> = {
  VIDEO_DIAL: "Video Dial",
  MULTIPLE_CHOICE: "Multiple Choice",
  LIKERT: "Likert Scale",
  OPEN_TEXT: "Open Text",
  NUMERIC: "Numeric",
  AB_TEST: "A/B Test",
  RANKING: "Ranking",
  MATRIX: "Matrix",
  MULTI_ITEM_RATING: "Multi-Item Rating",
  SENTIMENT: "Sentiment",
  REACTION: "Reaction",
};

export const PHASE_LABELS: Record<string, string> = {
  SCREENING: "Screening",
  PRE_BALLOT: "Pre-Ballot",
  STIMULUS: "Stimulus",
  POST_BALLOT: "Post-Ballot",
};

export const PHASE_COLORS: Record<string, string> = {
  SCREENING: "bg-orange-100 text-orange-800",
  PRE_BALLOT: "bg-blue-100 text-blue-800",
  STIMULUS: "bg-purple-100 text-purple-800",
  POST_BALLOT: "bg-green-100 text-green-800",
};
