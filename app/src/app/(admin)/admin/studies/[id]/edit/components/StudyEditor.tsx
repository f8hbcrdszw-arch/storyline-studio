"use client";

import { useEffect, useState, useCallback } from "react";
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
import { ThemeEditor } from "./ThemeEditor";
import { DEFAULT_THEME, type SurveyTheme } from "@/lib/types/json-fields";
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
  useEffect(() => {
    hydrate(study, initialQuestions);
  }, [hydrate, study, initialQuestions]);

  // Autosave
  useAutosave();

  return (
    <EditorLayout
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
        {questions.length > 0 && (
          <a
            href={`/survey/${study.id}?preview=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Full Preview
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center panel: selected question editor + add question
// ─────────────────────────────────────────────────────────────────────────────

type EditorTab = "questions" | "theme";

function EditorCenter({ study, isLocked }: { study: StudyData; isLocked: boolean }) {
  const questions = useEditorStore((s) => s.questions);
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const selectQuestion = useEditorStore((s) => s.selectQuestion);
  const addQuestionToStore = useEditorStore((s) => s.addQuestion);
  const deleteQuestion = useEditorStore((s) => s.deleteQuestion);
  const undoDelete = useEditorStore((s) => s.undoDelete);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const lastDeleted = useEditorStore((s) => s.lastDeleted);

  const [activeTab, setActiveTab] = useState<EditorTab>("questions");
  const [theme, setTheme] = useState<SurveyTheme>(
    (study.settings as Record<string, unknown>)?.theme as SurveyTheme ?? DEFAULT_THEME
  );
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  // Debounced theme save
  const saveThemeRef = useCallback(
    async (newTheme: SurveyTheme) => {
      setThemeSaving(true);
      setThemeError(null);
      try {
        const res = await fetch(`/api/studies/${study.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: {
              ...(study.settings as Record<string, unknown>),
              theme: newTheme,
            },
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setThemeError(data.error || "Failed to save theme");
        }
      } catch {
        setThemeError("Network error saving theme");
      } finally {
        setThemeSaving(false);
      }
    },
    [study.id, study.settings]
  );

  // Debounce theme saves by 800ms
  const themeTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleThemeUpdate = useCallback(
    (newTheme: SurveyTheme) => {
      setTheme(newTheme);
      if (themeTimerRef[0]) clearTimeout(themeTimerRef[0]);
      themeTimerRef[0] = setTimeout(() => saveThemeRef(newTheme), 800);
    },
    [saveThemeRef, themeTimerRef]
  );

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

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
      {/* Tab switcher */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("questions")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            activeTab === "questions"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Questions
        </button>
        <button
          onClick={() => setActiveTab("theme")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            activeTab === "theme"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Theme
        </button>
      </div>

      {/* Theme tab */}
      {activeTab === "theme" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Survey Theme</h3>
            {themeSaving && (
              <span className="text-[10px] text-muted-foreground">Saving...</span>
            )}
            {themeError && (
              <span className="text-[10px] text-destructive">{themeError}</span>
            )}
          </div>
          <ThemeEditor
            theme={theme}
            onUpdate={handleThemeUpdate}
            isLocked={isLocked}
          />
        </div>
      )}

      {/* Questions tab */}
      {activeTab === "questions" && !selectedQuestion && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground mb-6">
            {questions.length === 0
              ? "No questions yet. Add your first question below."
              : "Select a question from the list to edit it."}
          </p>
          {!isLocked && (
            <div className="w-full max-w-sm">
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
                  className="w-full"
                >
                  + Add Question
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "questions" && selectedQuestion && (
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save indicator
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
