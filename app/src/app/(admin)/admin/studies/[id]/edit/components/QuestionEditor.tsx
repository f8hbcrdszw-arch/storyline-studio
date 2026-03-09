"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "motion/react";
import type { QuestionData } from "@/lib/types/question";
import { MediaUploader } from "./MediaUploader";
import { SkipLogicEditor } from "./SkipLogicEditor";
import { OptionsEditor } from "./OptionsEditor";
import { CONFIG_COMPONENTS } from "./configs";
import { springForIntent, staggerDelay } from "@/lib/motion";

const PHASE_OPTIONS = [
  { value: "SCREENING", label: "Screening" },
  { value: "PRE_BALLOT", label: "Pre-Ballot" },
  { value: "STIMULUS", label: "Stimulus" },
  { value: "POST_BALLOT", label: "Post-Ballot" },
];

// Question types that use options
const OPTION_TYPES = new Set([
  "MULTIPLE_CHOICE",
  "AB_TEST",
  "RANKING",
  "SENTIMENT",
  "REACTION",
  "MULTI_ITEM_RATING",
]);

// Types that support media attachments (question-level, not per-option)
const MEDIA_TYPES = new Set(["VIDEO_DIAL", "SENTIMENT"]);

// Staggered reveal for editor sections
function StaggerChild({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...springForIntent("reveal"),
        delay: staggerDelay(index, 40),
      }}
    >
      {children}
    </motion.div>
  );
}

export function QuestionEditor({
  question,
  allQuestions,
  isLocked,
  onUpdate,
  onDuplicateToPhase,
}: {
  question: QuestionData;
  allQuestions: QuestionData[];
  isLocked: boolean;
  onUpdate: (updates: Partial<QuestionData>) => void;
  onDuplicateToPhase?: (question: QuestionData, targetPhase: string) => Promise<string | null>;
}) {
  const [duplicating, setDuplicating] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Auto-focus title on mount
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Bidirectional preview sync — listen for focus-field events from LivePreview
  useEffect(() => {
    function handleFocusField(e: Event) {
      const { questionId, field } = (e as CustomEvent).detail;
      if (questionId !== question.id) return;

      switch (field) {
        case "title":
          titleRef.current?.focus();
          titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        case "prompt":
          promptRef.current?.focus();
          promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        case "options":
          optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          // Focus first option input
          const firstInput = optionsRef.current?.querySelector("input[type='text']") as HTMLInputElement | null;
          firstInput?.focus();
          break;
      }
    }

    window.addEventListener("editor:focus-field", handleFocusField);
    return () => window.removeEventListener("editor:focus-field", handleFocusField);
  }, [question.id]);

  const updateField = useCallback(
    <K extends keyof QuestionData>(field: K, value: QuestionData[K]) => {
      onUpdate({ [field]: value } as Partial<QuestionData>);
    },
    [onUpdate]
  );

  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ config: { ...question.config, [key]: value } });
    },
    [onUpdate, question.config]
  );

  // Look up the config component for this question type
  const ConfigComponent = CONFIG_COMPONENTS[question.type] ?? null;

  // Build sections array for stagger indexing
  let staggerIndex = 0;

  return (
    <div className="mt-2 pt-4 border-t border-border/40 space-y-6">
      {/* Question text — borderless, survey-scale */}
      <StaggerChild index={staggerIndex++}>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider block mb-2">
            Question
          </label>
          <input
            ref={titleRef}
            type="text"
            value={question.title}
            onChange={(e) => updateField("title", e.target.value)}
            disabled={isLocked}
            className={`w-full bg-transparent text-lg font-medium text-foreground px-0 py-1 border-0 border-b-2 transition-colors duration-200 focus:outline-none placeholder:text-muted-foreground/30 placeholder:italic ${
              question.title.trim() === ""
                ? "border-destructive/40"
                : "border-transparent hover:border-muted-foreground/15 focus:border-primary/50"
            }`}
            placeholder="Ask your question..."
          />
        </div>
      </StaggerChild>

      {/* Instructions — subtle, expandable */}
      <StaggerChild index={staggerIndex++}>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider block mb-2">
            Instructions
            <span className="font-normal normal-case tracking-normal text-muted-foreground/40 ml-1.5">optional</span>
          </label>
          <textarea
            ref={promptRef}
            value={question.prompt || ""}
            onChange={(e) => updateField("prompt", e.target.value || null)}
            disabled={isLocked}
            rows={2}
            className="w-full bg-transparent text-sm text-muted-foreground px-0 py-1 border-0 border-b transition-colors duration-200 border-transparent hover:border-muted-foreground/15 focus:border-primary/40 focus:outline-none resize-none placeholder:text-muted-foreground/30 placeholder:italic"
            placeholder="Add context or directions..."
          />
        </div>
      </StaggerChild>

      {/* Phase + settings */}
      <StaggerChild index={staggerIndex++}>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider block mb-2">
              Phase
            </label>
            <div className="flex gap-1.5">
              {PHASE_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateField("phase", p.value)}
                  disabled={isLocked}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                    question.phase === p.value
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "bg-background text-muted-foreground hover:text-foreground border border-border/60 hover:border-border"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post-ballot pair prompt */}
          {question.phase === "PRE_BALLOT" && onDuplicateToPhase && !isLocked && (
            <div className="bg-blue-50/80 border border-blue-200/60 rounded-lg px-3 py-2.5">
              {allQuestions.some(
                (q) =>
                  q.id !== question.id &&
                  q.phase === "POST_BALLOT" &&
                  q.type === question.type &&
                  q.title === question.title
              ) ? (
                <p className="text-xs text-blue-600">Post-ballot pair exists</p>
              ) : (
                <button
                  onClick={async () => {
                    setDuplicating(true);
                    setDupError(null);
                    const err = await onDuplicateToPhase(question, "POST_BALLOT");
                    if (err) setDupError(err);
                    setDuplicating(false);
                  }}
                  disabled={duplicating}
                  className="text-xs text-blue-700 font-medium hover:underline disabled:opacity-50"
                >
                  {duplicating ? "Creating..." : "Create post-ballot pair"}
                </button>
              )}
              <p className="text-[10px] text-blue-500 mt-0.5">
                Measure attitude shift by asking the same question after stimulus
              </p>
              {dupError && (
                <p className="text-[10px] text-destructive mt-1">{dupError}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-5 pt-2 border-t border-border/40">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => updateField("required", e.target.checked)}
                disabled={isLocked}
                className="rounded border-muted-foreground/30"
              />
              Required
            </label>

            {question.phase === "SCREENING" && (
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={question.isScreening}
                  onChange={(e) => updateField("isScreening", e.target.checked)}
                  disabled={isLocked}
                  className="rounded border-muted-foreground/30"
                />
                Terminate unqualified
              </label>
            )}
          </div>
        </div>
      </StaggerChild>

      {/* Type-specific config via registry */}
      {ConfigComponent && (
        <StaggerChild index={staggerIndex++}>
          <ConfigComponent
            config={question.config}
            onUpdate={updateConfig}
            isLocked={isLocked}
          />
        </StaggerChild>
      )}

      {/* Options editor for applicable types */}
      {OPTION_TYPES.has(question.type) && (
        <StaggerChild index={staggerIndex++}>
          <div ref={optionsRef}>
            <OptionsEditor
              options={question.options}
              questionType={question.type}
              isLocked={isLocked}
              onUpdate={(options) => onUpdate({ options })}
            />
          </div>
        </StaggerChild>
      )}

      {/* Media uploader for applicable types */}
      {MEDIA_TYPES.has(question.type) && (
        <StaggerChild index={staggerIndex++}>
          <MediaUploader
            questionId={question.id}
            mediaItems={question.mediaItems}
            onMediaAdded={(item) =>
              onUpdate({ mediaItems: [...question.mediaItems, item] })
            }
            onMediaRemoved={(id: string) =>
              onUpdate({ mediaItems: question.mediaItems.filter((m) => m.id !== id) })
            }
            maxItems={question.type === "VIDEO_DIAL" ? 1 : undefined}
          />
        </StaggerChild>
      )}

      {/* Skip logic */}
      <StaggerChild index={staggerIndex++}>
        <SkipLogicEditor
          question={question}
          allQuestions={allQuestions}
          onUpdate={(skipLogic) => {
            onUpdate({ skipLogic: skipLogic as QuestionData["skipLogic"] });
          }}
          isLocked={isLocked}
        />
      </StaggerChild>
    </div>
  );
}
