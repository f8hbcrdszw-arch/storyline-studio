"use client";

import { useState, useEffect, useCallback } from "react";
import { QuestionResults } from "./QuestionResults";

interface QuestionInfo {
  id: string;
  title: string;
  type: string;
  phase: string;
  order: number;
  isScreening: boolean;
  options: { id: string; label: string; value: string }[];
  mediaItems: { id: string; source: string; youtubeId: string | null; url: string | null }[];
}

export function ResultsDashboard({
  studyId,
  questions,
}: {
  studyId: string;
  questions: QuestionInfo[];
}) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id || null
  );
  const [segmentQuestionId, setSegmentQuestionId] = useState<string>("");
  const [segmentValue, setSegmentValue] = useState<string>("");

  const screeningQuestions = questions.filter((q) => q.isScreening);
  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

  const segmentQuestion = screeningQuestions.find(
    (q) => q.id === segmentQuestionId
  );

  return (
    <div className="space-y-6">
      {/* Segment filter */}
      {screeningQuestions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Segment by:
          </span>
          <select
            value={segmentQuestionId}
            onChange={(e) => {
              setSegmentQuestionId(e.target.value);
              setSegmentValue("");
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">All respondents</option>
            {screeningQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.order + 1}: {q.title}
              </option>
            ))}
          </select>

          {segmentQuestion && segmentQuestion.options.length > 0 && (
            <select
              value={segmentValue}
              onChange={(e) => setSegmentValue(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">Select value...</option>
              {segmentQuestion.options.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Question list + results */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Question list sidebar */}
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Questions
          </h3>
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestionId(q.id)}
              className={`w-full text-left rounded-lg border p-2 transition-colors text-sm ${
                selectedQuestionId === q.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <span className="text-muted-foreground mr-1.5">
                Q{q.order + 1}
              </span>
              <span className="text-foreground">{q.title}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {q.type.replace(/_/g, " ")}
              </p>
            </button>
          ))}
        </div>

        {/* Results panel */}
        <div>
          {selectedQuestion ? (
            <QuestionResults
              key={`${selectedQuestion.id}-${segmentQuestionId}-${segmentValue}`}
              studyId={studyId}
              question={selectedQuestion}
              segmentFilter={
                segmentQuestionId && segmentValue
                  ? { questionId: segmentQuestionId, value: segmentValue }
                  : undefined
              }
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a question to view results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
