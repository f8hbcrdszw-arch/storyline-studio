"use client";

import { useState } from "react";
import Link from "next/link";
import { QuestionRenderer } from "@/components/survey";
import type { QuestionData } from "@/lib/types/question";

type DeviceMode = "mobile" | "tablet" | "desktop";
type ViewMode = "interactive" | "all";

const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
};

const DEVICE_ICONS: Record<DeviceMode, React.ReactNode> = {
  mobile: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  tablet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  desktop: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
};

import { TYPE_LABELS, PHASE_LABELS } from "@/lib/constants/editor";

export function PreviewShell({
  studyId,
  studyTitle,
  slug,
  questions,
}: {
  studyId: string;
  studyTitle: string;
  slug: string;
  questions: QuestionData[];
}) {
  const [device, setDevice] = useState<DeviceMode>("mobile");
  const [view, setView] = useState<ViewMode>("interactive");

  const surveyUrl = `/survey/${slug}?preview=true`;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border bg-background px-4 py-2 flex items-center justify-between gap-4">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/admin/studies/${studyId}/edit`}
            className="text-muted-foreground hover:text-foreground text-sm shrink-0"
          >
            &larr; Editor
          </Link>
          <span className="text-sm font-medium truncate">{studyTitle}</span>
          <span className="label-mono text-muted-foreground/60 shrink-0">Preview</span>
        </div>

        {/* Center: device selector */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(Object.keys(DEVICE_WIDTHS) as DeviceMode[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                device === d
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={`${d} (${DEVICE_WIDTHS[d]}px)`}
            >
              {DEVICE_ICONS[d]}
              <span className="capitalize hidden sm:inline">{d}</span>
            </button>
          ))}
        </div>

        {/* Right: view mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView("interactive")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              view === "interactive"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Interactive
          </button>
          <button
            onClick={() => setView("all")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              view === "all"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Questions
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto flex justify-center py-6">
        {view === "interactive" ? (
          <InteractivePreview
            surveyUrl={surveyUrl}
            width={DEVICE_WIDTHS[device]}
            device={device}
          />
        ) : (
          <AllQuestionsPreview
            questions={questions}
            width={DEVICE_WIDTHS[device]}
            device={device}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive mode — iframe embedding the actual survey in preview mode
// ─────────────────────────────────────────────────────────────────────────────

function InteractivePreview({
  surveyUrl,
  width,
  device,
}: {
  surveyUrl: string;
  width: number;
  device: DeviceMode;
}) {
  const frameHeight = device === "mobile" ? 812 : device === "tablet" ? 1024 : 768;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-background border border-border rounded-2xl shadow-lg overflow-hidden transition-all duration-300"
        style={{ width }}
      >
        {/* Device chrome */}
        {device === "mobile" && (
          <div className="h-7 bg-muted/40 flex items-center justify-center">
            <div className="w-20 h-1.5 rounded-full bg-border" />
          </div>
        )}
        {device === "desktop" && (
          <div className="h-8 bg-muted/40 flex items-center gap-1.5 px-3 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
            <div className="flex-1 mx-8">
              <div className="h-5 rounded-md bg-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground truncate px-2">
                  {surveyUrl}
                </span>
              </div>
            </div>
          </div>
        )}

        <iframe
          src={surveyUrl}
          title="Survey preview"
          className="w-full border-0"
          style={{ height: frameHeight }}
        />

        {/* Bottom bar for mobile */}
        {device === "mobile" && (
          <div className="h-5 bg-muted/40 flex items-center justify-center">
            <div className="w-24 h-1 rounded-full bg-border" />
          </div>
        )}
      </div>

      <span className="text-[10px] text-muted-foreground">
        {width}px {device === "mobile" && "× 812px"}
        {device === "tablet" && "× 1024px"}
        {device === "desktop" && "× 768px"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// All Questions mode — scrollable list of every question rendered inline
// ─────────────────────────────────────────────────────────────────────────────

function AllQuestionsPreview({
  questions,
  width,
  device,
}: {
  questions: QuestionData[];
  width: number;
  device: DeviceMode;
}) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No questions to preview</p>
      </div>
    );
  }

  // Group by phase for visual separation
  let currentPhase = "";

  return (
    <div
      className="transition-all duration-300"
      style={{ width }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-lg overflow-hidden">
        {/* Device chrome */}
        {device === "desktop" && (
          <div className="h-8 bg-muted/40 flex items-center gap-1.5 px-3 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
        )}
        {device === "mobile" && (
          <div className="h-7 bg-muted/40 flex items-center justify-center">
            <div className="w-20 h-1.5 rounded-full bg-border" />
          </div>
        )}

        <div className="divide-y divide-border">
          {questions.map((q, i) => {
            const showPhaseHeader = q.phase !== currentPhase;
            currentPhase = q.phase;

            return (
              <div key={q.id}>
                {/* Phase divider */}
                {showPhaseHeader && (
                  <div className="bg-muted/30 px-4 py-2 border-b border-border">
                    <span className="label-mono text-muted-foreground">
                      {PHASE_LABELS[q.phase] ?? q.phase}
                    </span>
                  </div>
                )}

                {/* Question card */}
                <div className="p-4">
                  {/* Question metadata */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Q{i + 1}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {TYPE_LABELS[q.type] ?? q.type}
                    </span>
                    {q.required && (
                      <span className="text-[10px] text-destructive">Required</span>
                    )}
                    {q.isScreening && (
                      <span className="text-[10px] text-amber-600">Screening</span>
                    )}
                  </div>

                  {/* Rendered question */}
                  <QuestionRenderer
                    question={q}
                    existingAnswer={null}
                    onSubmit={() => {}}
                    loading={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
