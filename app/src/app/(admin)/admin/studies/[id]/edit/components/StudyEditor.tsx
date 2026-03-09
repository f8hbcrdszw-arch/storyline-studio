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
import { springForIntent } from "@/lib/motion";
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
          className="text-muted-foreground/60 hover:text-foreground text-xs shrink-0 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline -mt-px mr-1">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>
        <div className="w-px h-4 bg-border/40" />
        <h1 className="text-sm font-medium truncate text-foreground">{study.title}</h1>
        {isLocked && (
          <span className="text-[10px] text-amber-600/70 bg-amber-50/80 px-2 py-0.5 rounded-full shrink-0">
            Locked
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] tabular-nums text-muted-foreground/30">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </span>
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
      {/* AnimatePresence enables simultaneous exit of old question + enter of new question.
          mode="wait" ensures clean handoff; the exiting card fades out quickly while
          the new card fades in — no overlapping layouts. */}
      <AnimatePresence mode="wait" initial={false}>
        {!selectedQuestion ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            {questions.length === 0 ? (
              <>
                {/* Empty spine — elegant minimal illustration */}
                <div className="flex flex-col items-center gap-1.5 mb-8">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-primary/25 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                  </div>
                  <div className="w-px h-6 bg-gradient-to-b from-primary/15 to-border/20" />
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-border/25" />
                  <div className="w-px h-4 bg-gradient-to-b from-border/20 to-transparent" />
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-border/15" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Your survey starts here
                </p>
                <p className="text-xs text-muted-foreground/50 mb-8 max-w-[200px]">
                  Add your first question to begin building
                </p>
              </>
            ) : (
              <>
                {/* Has questions but none selected */}
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-xl border-2 border-dashed border-border/30 flex items-center justify-center mb-4 mx-auto">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground/25">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground/50">
                    Select a question to edit
                  </p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">
                    or use arrow keys to navigate
                  </p>
                </div>
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
                    className="w-full rounded-xl border-dashed border-border/60 hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
                  >
                    + Add Question
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={selectedQuestion.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={springForIntent("select")}
          >
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
              <div className="mt-6 pt-4">
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
                  <button
                    onClick={() => setShowTypeSelector(true)}
                    className="w-full py-3 text-xs text-muted-foreground/40 hover:text-primary border border-dashed border-border/40 hover:border-primary/30 rounded-xl transition-all hover:bg-primary/[0.02] group"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="group-hover:rotate-90 transition-transform duration-200"
                      >
                        <line x1="6" y1="1" x2="6" y2="11" />
                        <line x1="1" y1="6" x2="11" y2="6" />
                      </svg>
                      Add question
                    </span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
