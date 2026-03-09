"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEditorStore } from "@/stores/editor-store";
import { useAutosave } from "@/stores/use-autosave";
import { EditorLayout } from "./EditorLayout";
import { QuestionList } from "./QuestionList";
import { QuestionEditor } from "./QuestionEditor";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { LivePreview } from "./LivePreview";
import { SortableQuestion } from "./SortableQuestion";
import type { QuestionData } from "@/lib/types/question";
import type { StudyData } from "@/lib/types/study";

// Re-export for consumers that import from here
export type { QuestionData } from "@/lib/types/question";
export type { QuestionOptionData as QuestionOption, MediaItemData } from "@/lib/types/question";

export function StudyEditor({
  study,
  initialQuestions,
  isLocked,
}: {
  study: StudyData;
  initialQuestions: QuestionData[];
  isLocked: boolean;
}) {
  // Hydrate store on mount
  const hydrate = useEditorStore((s) => s.hydrate);
  const selectQuestion = useEditorStore((s) => s.selectQuestion);
  useEffect(() => {
    hydrate(study, initialQuestions);

    // Auto-select question from ?q= URL param
    const params = new URLSearchParams(window.location.search);
    const qId = params.get("q");
    if (qId && initialQuestions.some((q) => q.id === qId)) {
      selectQuestion(qId);
    }
  }, [hydrate, selectQuestion, study, initialQuestions]);

  // Autosave
  useAutosave();

  return (
    <EditorLayout
      saveBar={<AmbientSaveBar />}
      header={<EditorHeader study={study} isLocked={isLocked} />}
      questionList={<QuestionList isLocked={isLocked} />}
      editor={<EditorCenter study={study} isLocked={isLocked} />}
      preview={<LivePreview />}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header bar with back link, title, save indicator, preview link
// ─────────────────────────────────────────────────────────────────────────────

function EditorHeader({ study, isLocked }: { study: StudyData; isLocked: boolean }) {
  const questions = useEditorStore((s) => s.questions);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={`/admin/studies/${study.id}`}
          className="text-muted-foreground hover:text-foreground text-sm shrink-0"
        >
          &larr; Back
        </Link>
        <h1 className="text-base font-semibold truncate">{study.title}</h1>
        {isLocked && (
          <span className="text-[10px] text-amber-600 shrink-0">
            Locked — has responses
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <SaveIndicator />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center panel: selected question editor + add question
// ─────────────────────────────────────────────────────────────────────────────

function EditorCenter({ study, isLocked }: { study: StudyData; isLocked: boolean }) {
  const questions = useEditorStore((s) => s.questions);
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const selectQuestion = useEditorStore((s) => s.selectQuestion);
  const addQuestionToStore = useEditorStore((s) => s.addQuestion);
  const deleteQuestion = useEditorStore((s) => s.deleteQuestion);
  const undoDelete = useEditorStore((s) => s.undoDelete);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const lastDeleted = useEditorStore((s) => s.lastDeleted);

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.isContentEditable) return;

      // Arrow up/down — navigate questions
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = questions.findIndex((q) => q.id === selectedQuestionId);
        if (e.key === "ArrowUp") {
          const prevIndex = currentIndex <= 0 ? questions.length - 1 : currentIndex - 1;
          selectQuestion(questions[prevIndex]?.id ?? null);
        } else {
          const nextIndex = currentIndex >= questions.length - 1 ? 0 : currentIndex + 1;
          selectQuestion(questions[nextIndex]?.id ?? null);
        }
      }

      // Escape — deselect question
      if (e.key === "Escape" && selectedQuestionId) {
        e.preventDefault();
        selectQuestion(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [questions, selectedQuestionId, selectQuestion]);

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
          setAddError(data.error || `Failed to add question (${res.status})`);
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
      if (res.ok) deleteQuestion(questionId);
    },
    [deleteQuestion]
  );

  const handleDuplicateToPhase = useCallback(
    async (sourceQuestion: QuestionData, targetPhase: string): Promise<string | null> => {
      try {
        const config =
          sourceQuestion.config && Object.keys(sourceQuestion.config).length > 0
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
          return data.error || `Failed (${res.status})`;
        }

        const newQuestion = await res.json();
        addQuestionToStore({
          ...newQuestion,
          config: newQuestion.config ?? {},
          skipLogic: newQuestion.skipLogic ?? null,
          options: newQuestion.options ?? [],
          mediaItems: newQuestion.mediaItems ?? [],
        });
        return null;
      } catch {
        return "Network error";
      }
    },
    [study.id, addQuestionToStore]
  );

  return (
    <div>
      {!selectedQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.05 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          {questions.length === 0 ? (
            <>
              {/* Empty spine node */}
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="w-4 h-4 rounded-full border-2 border-dashed border-primary/20" />
                <div className="w-px h-8 bg-border/40" />
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-border/30" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Your survey starts here
              </p>
              <p className="text-xs text-muted-foreground/60 mb-6">
                Add your first question to begin building
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground/60 mb-6">
                Select a question from the list to edit
              </p>
            </>
          )}
          {!isLocked && (
            <div className="w-full max-w-xs">
              {addError && (
                <p className="text-sm text-destructive mb-2">{addError}</p>
              )}
              {showTypeSelector ? (
                <QuestionTypeSelector
                  phase="PRE_BALLOT"
                  onSelect={handleAddQuestion}
                  onCancel={() => setShowTypeSelector(false)}
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowTypeSelector(true)}
                  className="w-full rounded-xl"
                >
                  + Add Question
                </Button>
              )}
            </div>
          )}
        </motion.div>
      )}

      {selectedQuestion && (
        <>
          {/* Question card with inline editor */}
          <SortableQuestion
            question={selectedQuestion}
            allQuestions={questions}
            isSelected={true}
            isLocked={isLocked}
            onSelect={() => {}}
            onDelete={() => handleDeleteQuestion(selectedQuestion.id)}
            onUpdate={(updates) => updateQuestion(selectedQuestion.id, updates)}
            onDuplicateToPhase={handleDuplicateToPhase}
          />

          {/* Add question below */}
          {!isLocked && (
            <div className="mt-4 pt-4 border-t border-border">
              {addError && (
                <p className="text-sm text-destructive mb-2">{addError}</p>
              )}
              {showTypeSelector ? (
                <QuestionTypeSelector
                  phase={selectedQuestion.phase}
                  onSelect={handleAddQuestion}
                  onCancel={() => setShowTypeSelector(false)}
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowTypeSelector(true)}
                  className="w-full"
                  size="sm"
                >
                  + Add Question
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Undo delete toast */}
      <AnimatePresence>
        {lastDeleted && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border/60 bg-background/95 backdrop-blur-sm px-4 py-3 shadow-xl"
          >
            <span className="text-sm text-foreground">
              Deleted &ldquo;{lastDeleted.question.title}&rdquo;
            </span>
            <button
              onClick={undoDelete}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Undo
            </button>
            {/* Countdown bar */}
            <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full overflow-hidden">
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: "linear" }}
                className="h-full bg-primary/30 origin-left"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient save bar — 2px line at top of viewport
// Communicates save state through environment, not labels
// ─────────────────────────────────────────────────────────────────────────────

function AmbientSaveBar() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const saveError = useEditorStore((s) => s.saveError);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  // Determine bar state
  type BarState = "idle" | "dirty" | "saving" | "saved" | "error";
  let state: BarState = "idle";
  if (saveError) state = "error";
  else if (isSaving) state = "saving";
  else if (isDirty) state = "dirty";
  else if (lastSavedAt) state = "saved";

  // Auto-clear "saved" state after 2s
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (state === "saved") {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
    if (state !== "idle") setShowSaved(false);
  }, [state, lastSavedAt]);

  const visible = state === "dirty" || state === "saving" || state === "error" || showSaved;

  return (
    <div
      className="h-[2px] w-full shrink-0 relative overflow-hidden"
      aria-hidden="true"
    >
      {/* Base bar — amber for dirty, animated sweep for saving, green for saved, red for error */}
      <div
        className={`absolute inset-0 transition-all duration-500 ${
          !visible
            ? "opacity-0"
            : state === "error"
            ? "opacity-100 bg-destructive"
            : state === "saving"
            ? "opacity-100"
            : state === "dirty"
            ? "opacity-60 bg-amber-400"
            : showSaved
            ? "opacity-100 bg-green-500"
            : "opacity-0"
        }`}
      />

      {/* Saving sweep animation — gradient that moves L→R */}
      {state === "saving" && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent animate-sweep"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact save indicator for the header (small text fallback)
// ─────────────────────────────────────────────────────────────────────────────

function SaveIndicator() {
  const saveError = useEditorStore((s) => s.saveError);

  // Only show text for errors — ambient bar handles the rest
  if (!saveError) return null;

  return (
    <button
      onClick={() => {
        // TODO: retry save
      }}
      className="text-[11px] text-destructive hover:underline"
    >
      Save failed — retry
    </button>
  );
}
