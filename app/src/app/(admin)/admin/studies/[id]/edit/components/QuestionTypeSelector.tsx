"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const QUESTION_TYPES = [
  {
    category: "Core",
    types: [
      { value: "VIDEO_DIAL", label: "Video Dial", desc: "Real-time slider feedback during video playback" },
      { value: "MULTIPLE_CHOICE", label: "Multiple Choice", desc: "Select from text, bubble, or image options" },
      { value: "LIKERT", label: "Likert Scale", desc: "Single-item rating scale" },
      { value: "NUMERIC", label: "Numeric", desc: "Number input with min/max" },
      { value: "OPEN_TEXT", label: "Open Text", desc: "Free-form text response" },
    ],
  },
  {
    category: "Structured",
    types: [
      { value: "AB_TEST", label: "A/B Test", desc: "Compare two options side by side" },
      { value: "RANKING", label: "Ranking", desc: "Tap to rank options in order" },
      { value: "MATRIX", label: "Matrix", desc: "Row-by-column grid selection" },
      { value: "MULTI_ITEM_RATING", label: "Multi-Item Rating", desc: "Rate multiple items on same scale" },
    ],
  },
  {
    category: "Specialty",
    types: [
      { value: "SENTIMENT", label: "Sentiment", desc: "Tag options with configurable attributes" },
      { value: "REACTION", label: "Reaction", desc: "Overall rating plus multi-select feedback" },
    ],
  },
];

const PHASES = [
  { value: "SCREENING", label: "Screening" },
  { value: "PRE_BALLOT", label: "Pre-Ballot" },
  { value: "STIMULUS", label: "Stimulus" },
  { value: "POST_BALLOT", label: "Post-Ballot" },
];

export function QuestionTypeSelector({
  phase: defaultPhase,
  onSelect,
  onCancel,
}: {
  phase: string;
  onSelect: (type: string, phase: string) => void;
  onCancel: () => void;
}) {
  const [selectedPhase, setSelectedPhase] = useState(defaultPhase);

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Add Question</h3>
        <Button variant="ghost" size="icon-xs" onClick={onCancel}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Phase selector */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Phase
        </label>
        <div className="flex gap-1">
          {PHASES.map((p) => (
            <button
              key={p.value}
              onClick={() => setSelectedPhase(p.value)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedPhase === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type grid */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {QUESTION_TYPES.map((category) => (
          <div key={category.category}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {category.category}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {category.types.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onSelect(type.value, selectedPhase)}
                  className="text-left rounded-md border border-border p-2 hover:bg-accent transition-colors"
                >
                  <p className="text-xs font-medium text-foreground">
                    {type.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {type.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
