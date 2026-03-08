"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QuestionRenderer } from "@/components/survey";
import type { QuestionData } from "@/lib/types/question";

function withSignedUrls(
  q: QuestionData,
  signedUrls?: Record<string, string>
): QuestionData {
  if (!signedUrls) return q;
  return {
    ...q,
    options: q.options.map((opt) => ({
      ...opt,
      imageUrl: opt.imageUrl
        ? signedUrls[opt.imageUrl] ?? opt.imageUrl
        : opt.imageUrl,
    })),
  };
}

export function QuestionPreviewModal({
  open,
  question,
  onClose,
}: {
  open: boolean;
  question: QuestionData;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Sign R2 keys for option images when preview opens
  useEffect(() => {
    if (!open) return;
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
        if (data.urls) setSignedUrls(data.urls);
      })
      .catch(() => {});
  }, [open, question.options]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  useEffect(() => {
    if (visible && !closing) dialogRef.current?.focus();
  }, [visible, closing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!visible) return null;

  const surveyQuestion = withSignedUrls(question, signedUrls);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${
          closing
            ? "animate-out fade-out duration-200"
            : "animate-in fade-in duration-150"
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        className={`relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl mx-4 ${
          closing
            ? "animate-out fade-out zoom-out-95 duration-200"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Question preview"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Respondent Preview
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close preview"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Rendered question */}
        <QuestionRenderer
          question={surveyQuestion}
          existingAnswer={null}
          onSubmit={onClose}
          loading={false}
        />
      </div>
    </div>
  );
}
