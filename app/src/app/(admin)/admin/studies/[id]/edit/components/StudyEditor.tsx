"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableQuestion } from "./SortableQuestion";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type QuestionOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  imageUrl: string | null;
};

export type MediaItemData = {
  id: string;
  source: string;
  url: string | null;
  youtubeId: string | null;
  filename: string | null;
  type: string;
  durationSecs: number | null;
  thumbnailUrl: string | null;
};

export type QuestionData = {
  id: string;
  phase: string;
  type: string;
  order: number;
  title: string;
  prompt: string | null;
  config: Record<string, unknown>;
  required: boolean;
  isScreening: boolean;
  skipLogic: Record<string, unknown>[] | null;
  options: QuestionOption[];
  mediaItems: MediaItemData[];
};

type StudyData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  settings: Record<string, unknown>;
  responseCount: number;
};

const PHASES = ["SCREENING", "PRE_BALLOT", "STIMULUS", "POST_BALLOT"] as const;
const PHASE_LABELS: Record<string, string> = {
  SCREENING: "Screening",
  PRE_BALLOT: "Pre-Ballot",
  STIMULUS: "Stimulus",
  POST_BALLOT: "Post-Ballot",
};

export function StudyEditor({
  study,
  initialQuestions,
  isLocked,
}: {
  study: StudyData;
  initialQuestions: QuestionData[];
  isLocked: boolean;
}) {
  const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
  const [activePhase, setActivePhase] = useState<string>("ALL");
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredQuestions =
    activePhase === "ALL"
      ? questions
      : questions.filter((q) => q.phase === activePhase);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...questions];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // Update local state immediately
      setQuestions(reordered.map((q, i) => ({ ...q, order: i })));

      // Persist to server
      await fetch("/api/questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study.id,
          questionIds: reordered.map((q) => q.id),
        }),
      });
    },
    [questions, study.id]
  );

  const handleAddQuestion = useCallback(
    async (type: string, phase: string) => {
      setShowTypeSelector(false);

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study.id,
          type,
          phase,
          title: `New ${type.replace(/_/g, " ").toLowerCase()} question`,
        }),
      });

      if (res.ok) {
        const question = await res.json();
        setQuestions((prev) => [
          ...prev,
          {
            ...question,
            config: question.config ?? {},
            skipLogic: question.skipLogic ?? null,
            options: question.options ?? [],
            mediaItems: question.mediaItems ?? [],
          },
        ]);
        setSelectedQuestionId(question.id);
      }
    },
    [study.id]
  );

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setSelectedQuestionId(null);
    }
  }, []);

  const handleUpdateQuestion = useCallback(
    (questionId: string, updates: Partial<QuestionData>) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, ...updates } : q))
      );
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/studies/${study.id}`}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              &larr; Back
            </Link>
          </div>
          <h1 className="mt-1">{study.title}</h1>
          {isLocked && (
            <p className="text-xs text-amber-600 mt-1">
              This study has responses — structural edits are locked
            </p>
          )}
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setActivePhase("ALL")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activePhase === "ALL"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({questions.length})
        </button>
        {PHASES.map((phase) => {
          const count = questions.filter((q) => q.phase === phase).length;
          return (
            <button
              key={phase}
              onClick={() => setActivePhase(phase)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePhase === phase
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {PHASE_LABELS[phase]} ({count})
            </button>
          );
        })}
      </div>

      {/* Question list with drag-drop */}
      <div className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredQuestions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredQuestions.map((question) => (
                <SortableQuestion
                  key={question.id}
                  question={question}
                  allQuestions={questions}
                  isSelected={selectedQuestionId === question.id}
                  isLocked={isLocked}
                  onSelect={() =>
                    setSelectedQuestionId(
                      selectedQuestionId === question.id
                        ? null
                        : question.id
                    )
                  }
                  onDelete={() => handleDeleteQuestion(question.id)}
                  onUpdate={(updates) =>
                    handleUpdateQuestion(question.id, updates)
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {filteredQuestions.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {activePhase === "ALL"
                ? "No questions yet. Add your first question below."
                : `No ${PHASE_LABELS[activePhase]?.toLowerCase()} questions yet.`}
            </p>
          </div>
        )}
      </div>

      {/* Add question button */}
      {!isLocked && (
        <div className="mt-4 pt-4 border-t border-border">
          {showTypeSelector ? (
            <QuestionTypeSelector
              phase={activePhase === "ALL" ? "PRE_BALLOT" : activePhase}
              onSelect={handleAddQuestion}
              onCancel={() => setShowTypeSelector(false)}
            />
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowTypeSelector(true)}
              className="w-full"
            >
              + Add Question
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
