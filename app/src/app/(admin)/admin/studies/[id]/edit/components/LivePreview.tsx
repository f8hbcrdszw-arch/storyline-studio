"use client";

import { useState, useEffect } from "react";
import { QuestionRenderer } from "@/components/survey";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEditorStore } from "@/stores/editor-store";

/**
 * Live preview panel — renders the currently selected question
 * exactly as respondents would see it, updating in real-time.
 * The panel width IS the preview width — drag the panel to resize.
 */
export function LivePreview() {
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const questions = useEditorStore((s) => s.questions);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const question = questions.find((q) => q.id === selectedQuestionId);

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

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 mb-3">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <p className="text-xs text-muted-foreground">
          Select a question to preview
        </p>
      </div>
    );
  }

  // Apply signed URLs to options
  const previewQuestion = {
    ...question,
    options: question.options.map((opt) => ({
      ...opt,
      imageUrl: opt.imageUrl
        ? signedUrls[opt.imageUrl] ?? opt.imageUrl
        : opt.imageUrl,
    })),
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Preview
        </span>
      </div>

      {/* Preview content — fills the panel width naturally */}
      <div className="flex-1 overflow-y-auto p-4">
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
            key={question.id}
            question={previewQuestion}
            existingAnswer={null}
            onSubmit={() => {}}
            loading={false}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
