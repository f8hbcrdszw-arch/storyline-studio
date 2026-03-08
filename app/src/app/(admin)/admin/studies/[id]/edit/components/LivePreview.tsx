"use client";

import { useState, useEffect } from "react";
import { QuestionRenderer } from "@/components/survey";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEditorStore } from "@/stores/editor-store";

const DEVICE_WIDTHS = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
} as const;

type DeviceMode = keyof typeof DEVICE_WIDTHS;

/**
 * Live preview panel — renders the currently selected question
 * exactly as respondents would see it, updating in real-time.
 */
export function LivePreview() {
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const questions = useEditorStore((s) => s.questions);
  const [device, setDevice] = useState<DeviceMode>("mobile");
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
      {/* Device selector */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Preview
        </span>
        <div className="flex gap-0.5">
          {(Object.keys(DEVICE_WIDTHS) as DeviceMode[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                device === d
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {d === "mobile" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-0.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              )}
              {d === "tablet" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-0.5">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              )}
              {d === "desktop" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-0.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              )}
              <span className="capitalize">{d}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto p-3 flex justify-center">
        <div
          className="border border-border rounded-lg bg-background shadow-sm overflow-hidden transition-all duration-200"
          style={{
            width: `min(${DEVICE_WIDTHS[device]}px, 100%)`,
            minHeight: 400,
          }}
        >
          {/* Device frame chrome */}
          {device === "mobile" && (
            <div className="h-6 bg-muted/50 flex items-center justify-center border-b border-border">
              <div className="w-16 h-1 rounded-full bg-border" />
            </div>
          )}

          {/* Question render */}
          <div className="p-4">
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
      </div>
    </div>
  );
}
