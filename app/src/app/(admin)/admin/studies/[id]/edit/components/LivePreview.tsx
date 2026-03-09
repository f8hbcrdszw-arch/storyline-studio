"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { QuestionRenderer } from "@/components/survey";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEditorStore } from "@/stores/editor-store";
import { springForIntent } from "@/lib/motion";
import { TYPE_LABELS } from "@/lib/constants/editor";

/**
 * Live preview panel — renders the currently selected question
 * exactly as respondents would see it, updating in real-time.
 * The panel width IS the preview width — drag the panel to resize.
 */
export function LivePreview() {
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const questions = useEditorStore((s) => s.questions);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const prevQuestionIdRef = useRef<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  const question = questions.find((q) => q.id === selectedQuestionId);

  // Track navigation direction for slide animation
  useEffect(() => {
    if (!selectedQuestionId || !prevQuestionIdRef.current) {
      prevQuestionIdRef.current = selectedQuestionId;
      return;
    }
    const prevIndex = questions.findIndex((q) => q.id === prevQuestionIdRef.current);
    const nextIndex = questions.findIndex((q) => q.id === selectedQuestionId);
    setDirection(nextIndex >= prevIndex ? 1 : -1);
    prevQuestionIdRef.current = selectedQuestionId;
  }, [selectedQuestionId, questions]);

  // Sign R2 keys for option images when question changes
  useEffect(() => {
    if (!question) return;
    const keys = question.options
      .map((o) => o.imageUrl)
      .filter((url): url is string => !!url && !url.startsWith("http"));
    if (keys.length === 0) return;

    fetch("/api/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.urls) setSignedUrls((prev) => ({ ...prev, ...data.urls }));
      })
      .catch(() => {});
  }, [question?.id, question?.options]);

  // Apply signed URLs to options
  const previewQuestion = question
    ? {
        ...question,
        options: question.options.map((opt) => ({
          ...opt,
          imageUrl: opt.imageUrl
            ? signedUrls[opt.imageUrl] ?? opt.imageUrl
            : opt.imageUrl,
        })),
      }
    : null;

  const questionIndex = question
    ? questions.findIndex((q) => q.id === question.id)
    : -1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/60">
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          Respondent view
        </span>
        {question && (
          <span className="text-[10px] tabular-nums text-muted-foreground/40">
            Q{questionIndex + 1} of {questions.length}
          </span>
        )}
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait" initial={false}>
          {!previewQuestion ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center h-full p-6 text-center"
            >
              {/* Subtle device frame hint */}
              <div className="w-16 h-24 rounded-xl border-2 border-dashed border-border/30 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/25">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground/50">
                Select a question to preview
              </p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">
                See exactly what respondents see
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={previewQuestion.id}
              initial={{ opacity: 0, y: direction * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: direction * -8 }}
              transition={springForIntent("reveal")}
              className="p-4"
            >
              {/* Question type badge */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                <span className="text-[10px] text-muted-foreground/50">
                  {TYPE_LABELS[previewQuestion.type] || previewQuestion.type}
                </span>
                {previewQuestion.required && (
                  <span className="text-[10px] text-destructive/50">Required</span>
                )}
              </div>

              <ErrorBoundary
                fallback={
                  <div className="p-4 text-center">
                    <p className="text-xs text-destructive">Preview failed to render</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      The question may have invalid configuration
                    </p>
                  </div>
                }
              >
                <QuestionRenderer
                  question={previewQuestion}
                  existingAnswer={null}
                  onSubmit={() => {}}
                  loading={false}
                />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom hint */}
      {previewQuestion && (
        <div className="shrink-0 px-3 py-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Resize panel to test responsive layout
          </p>
        </div>
      )}
    </div>
  );
}
