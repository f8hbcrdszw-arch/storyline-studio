"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
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
        <div className="toolbar-row">
          <span className="section-label whitespace-nowrap">
            Segment by
          </span>
          <Select
            value={segmentQuestionId}
            onChange={(e) => {
              setSegmentQuestionId(e.target.value);
              setSegmentValue("");
            }}
            className="w-auto"
          >
            <option value="">All respondents</option>
            {screeningQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.order + 1}: {q.title}
              </option>
            ))}
          </Select>

          {segmentQuestion && segmentQuestion.options.length > 0 && (
            <Select
              value={segmentValue}
              onChange={(e) => setSegmentValue(e.target.value)}
              className="w-auto"
            >
              <option value="">Select value...</option>
              {segmentQuestion.options.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {/* Question list + results */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Question list sidebar */}
        <div>
          <p className="section-label mb-3">Questions</p>
          <div className="space-y-px">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQuestionId(q.id)}
                className={`w-full text-left px-3 py-2 text-sm border-l-2 ${
                  selectedQuestionId === q.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-transparent hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-xs mr-1.5 tabular-nums">
                  Q{q.order + 1}
                </span>
                <span className="font-medium">{q.title}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                  {q.type.replace(/_/g, " ").toLowerCase()}
                </p>
              </button>
            ))}
          </div>
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
            <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
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
