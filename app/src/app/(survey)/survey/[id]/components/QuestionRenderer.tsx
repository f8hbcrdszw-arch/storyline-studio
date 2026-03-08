"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { VideoDial } from "./video-dial/VideoDial";
import type { QuestionData } from "@/lib/types/question";
import type { QuestionBodyProps } from "./questions/types";

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic imports — each question type lazy-loads on first use
// ─────────────────────────────────────────────────────────────────────────────

const Loading = () => (
  <div className="flex items-center justify-center py-8">
    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const DynMultipleChoice = dynamic(() => import("./questions/MultipleChoiceQuestion"), { loading: Loading });
const DynLikert = dynamic(() => import("./questions/LikertQuestion"), { loading: Loading });
const DynMultiItemRating = dynamic(() => import("./questions/MultiItemRatingQuestion"), { loading: Loading });
const DynNumeric = dynamic(() => import("./questions/NumericQuestion"), { loading: Loading });
const DynOpenText = dynamic(() => import("./questions/OpenTextQuestion"), { loading: Loading });
const DynABTest = dynamic(() => import("./questions/ABTestQuestion"), { loading: Loading });
const DynMatrix = dynamic(() => import("./questions/MatrixQuestion"), { loading: Loading });
const DynRanking = dynamic(() => import("./questions/RankingQuestion"), { loading: Loading });
const DynSentiment = dynamic(() => import("./questions/SentimentQuestion"), { loading: Loading });
const DynReaction = dynamic(() => import("./questions/ReactionQuestion"), { loading: Loading });

// ─────────────────────────────────────────────────────────────────────────────
// Respondent-facing question renderer
// ─────────────────────────────────────────────────────────────────────────────

export function QuestionRenderer({
  question,
  existingAnswer,
  onSubmit,
  onBack,
  loading,
}: {
  question: QuestionData;
  existingAnswer: unknown;
  onSubmit: (value: unknown) => void;
  onBack?: () => void;
  loading: boolean;
}) {
  const [answer, setAnswer] = useState<unknown>(existingAnswer ?? null);

  const handleSubmit = useCallback(() => {
    if (answer !== null) {
      onSubmit(answer);
    }
  }, [answer, onSubmit]);

  const isValid = answer !== null && answer !== undefined;

  // VIDEO_DIAL has its own submit flow (video must finish first)
  if (question.type === "VIDEO_DIAL") {
    return (
      <div className="space-y-6">
        <div>
          <h2>{question.title}</h2>
          {question.prompt && (
            <p className="text-sm text-muted-foreground mt-1">
              {question.prompt}
            </p>
          )}
        </div>
        <VideoDial question={question} onSubmit={onSubmit} loading={loading} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Question header */}
      <div>
        <h2>{question.title}</h2>
        {question.prompt && (
          <p className="text-sm text-muted-foreground mt-1">
            {question.prompt}
          </p>
        )}
      </div>

      {/* Question body — type-specific (lazy-loaded) */}
      <div className="min-h-[200px]">
        <QuestionBody
          question={question}
          answer={answer}
          onChange={setAnswer}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={loading}>
            &larr; Back
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={handleSubmit}
          disabled={loading || (question.required && !isValid)}
        >
          {loading ? "Saving..." : "Next"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type router — maps question type to dynamically imported component
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_COMPONENTS: Record<
  string,
  React.ComponentType<QuestionBodyProps>
> = {
  MULTIPLE_CHOICE: DynMultipleChoice,
  LIKERT: DynLikert,
  MULTI_ITEM_RATING: DynMultiItemRating,
  NUMERIC: DynNumeric,
  OPEN_TEXT: DynOpenText,
  AB_TEST: DynABTest,
  MATRIX: DynMatrix,
  RANKING: DynRanking,
  SENTIMENT: DynSentiment,
  REACTION: DynReaction,
};

function QuestionBody({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const Component = QUESTION_COMPONENTS[question.type];

  if (!Component) {
    return (
      <p className="text-sm text-muted-foreground">
        Unsupported question type: {question.type}
      </p>
    );
  }

  return <Component question={question} answer={answer} onChange={onChange} />;
}
