"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { useEditorStore } from "@/stores/editor-store";
import { useAutosave } from "@/stores/use-autosave";
import type { QuestionData } from "@/lib/types/question";
import type { StudyData } from "@/lib/types/study";

// Re-export for consumers that import from here
export type { QuestionData } from "@/lib/types/question";
export type { QuestionOptionData as QuestionOption, MediaItemData } from "@/lib/types/question";

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
  // Hydrate store on mount (Server Component -> Client Component pattern)
  const hydrate = useEditorStore((s) => s.hydrate);
  useEffect(() => {
    hydrate(study, initialQuestions);
  }, [hydrate, study, initialQuestions]);

  // Subscribe to store
  const questions = useEditorStore((s) => s.questions);
  const activePhase = useEditorStore((s) => s.activePhase);
  const setActivePhase = useEditorStore((s) => s.setActivePhase);
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const selectQuestion = useEditorStore((s) => s.selectQuestion);
  const addQuestionToStore = useEditorStore((s) => s.addQuestion);
  const deleteQuestion = useEditorStore((s) => s.deleteQuestion);
  const undoDelete = useEditorStore((s) => s.undoDelete);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);
  const lastDeleted = useEditorStore((s) => s.lastDeleted);

  // Autosave
  const { flush } = useAutosave();

  const reorderControllerRef = useRef<AbortController | null>(null);

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

      // Update store (triggers autosave)
      reorderQuestions(reordered.map((q, i) => ({ ...q, order: i })));

      // Also persist reorder immediately via dedicated endpoint
      reorderControllerRef.current?.abort();
      const controller = new AbortController();
      reorderControllerRef.current = controller;

      await fetch("/api/questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study.id,
          questionIds: reordered.map((q) => q.id),
        }),
        signal: controller.signal,
      }).catch((err) => {
        if (err.name !== "AbortError") console.error("Reorder failed:", err);
      });
    },
    [questions, study.id, reorderQuestions]
  );

  const [addError, setAddError] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleAddQuestion = useCallback(
    async (type: string, phase: string) => {
      setShowTypeSelector(false);
      setAddError(null);

      try {
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
          addQuestionToStore({
            ...question,
            config: question.config ?? {},
            skipLogic: question.skipLogic ?? null,
            options: question.options ?? [],
            mediaItems: question.mediaItems ?? [],
          });
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = data.error || data.message || `Failed to add question (${res.status})`;
          setAddError(msg);
        }
      } catch {
        setAddError("Network error — could not add question");
      }
    },
    [study.id, addQuestionToStore]
  );

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        deleteQuestion(questionId);
      }
    },
    [deleteQuestion]
  );

  const handleDuplicateToPhase = useCallback(
    async (sourceQuestion: QuestionData, targetPhase: string): Promise<string | null> => {
      try {
        const config = sourceQuestion.config && Object.keys(sourceQuestion.config).length > 0
          ? sourceQuestion.config
          : undefined;

        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studyId: study.id,
            type: sourceQuestion.type,
            phase: targetPhase,
            title: sourceQuestion.title,
            prompt: sourceQuestion.prompt,
            config,
            required: sourceQuestion.required,
            isScreening: false,
            options: sourceQuestion.options.map((opt) => ({
              label: opt.label,
              value: opt.value,
              order: opt.order,
              imageUrl: opt.imageUrl,
            })),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return data.error || `Failed to create duplicate (${res.status})`;
        }

        const newQuestion = await res.json();
        addQuestionToStore({
          ...newQuestion,
          config: newQuestion.config ?? {},
          skipLogic: newQuestion.skipLogic ?? null,
          options: newQuestion.options ?? [],
          mediaItems: newQuestion.mediaItems ?? [],
        });
        setActivePhase(targetPhase);
        return null;
      } catch {
        return "Network error — could not create duplicate";
      }
    },
    [study.id, addQuestionToStore, setActivePhase]
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
        <div className="flex items-center gap-3">
          <SaveIndicator />
          {questions.length > 0 && (
            <a
              href={`/survey/${study.id}?preview=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview Survey
            </a>
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
                    selectQuestion(
                      selectedQuestionId === question.id
                        ? null
                        : question.id
                    )
                  }
                  onDelete={() => handleDeleteQuestion(question.id)}
                  onUpdate={(updates) =>
                    updateQuestion(question.id, updates)
                  }
                  onDuplicateToPhase={handleDuplicateToPhase}
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

      {/* Undo delete toast */}
      {lastDeleted && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-sm text-foreground">
            Deleted &ldquo;{lastDeleted.question.title}&rdquo;
          </span>
          <button
            onClick={undoDelete}
            className="text-sm font-medium text-primary hover:underline"
          >
            Undo
          </button>
        </div>
      )}

      {/* Add question button */}
      {!isLocked && (
        <div className="mt-4 pt-4 border-t border-border">
          {addError && (
            <p className="text-sm text-destructive mb-2">{addError}</p>
          )}
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

// ─────────────────────────────────────────────────────────────────────────────
// Save indicator component
// ─────────────────────────────────────────────────────────────────────────────

function SaveIndicator() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const saveError = useEditorStore((s) => s.saveError);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  if (saveError) {
    return (
      <span className="text-xs text-destructive flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        {saveError}
      </span>
    );
  }

  if (isSaving) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Saving...
      </span>
    );
  }

  if (isDirty) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Unsaved changes
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Saved
      </span>
    );
  }

  return null;
}
