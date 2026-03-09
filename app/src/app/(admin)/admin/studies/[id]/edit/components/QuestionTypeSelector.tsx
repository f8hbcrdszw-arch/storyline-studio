"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { springForIntent } from "@/lib/motion";

const TYPE_ICONS: Record<string, string> = {
  VIDEO_DIAL: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  MULTIPLE_CHOICE: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  LIKERT: "M4 6h16M4 12h16M4 18h10",
  NUMERIC: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14",
  OPEN_TEXT: "M4 6h16M4 10h16M4 14h10",
  AB_TEST: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7",
  RANKING: "M3 4h13M3 8h9m-9 4h6",
  MATRIX: "M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 9h16M4 14h16M9 4v16M14 4v16",
  MULTI_ITEM_RATING: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  SENTIMENT: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  REACTION: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
};

const QUESTION_TYPES = [
  {
    category: "Core",
    types: [
      { value: "VIDEO_DIAL", label: "Video Dial", desc: "Real-time slider during video" },
      { value: "MULTIPLE_CHOICE", label: "Multiple Choice", desc: "Text, bubble, or image options" },
      { value: "LIKERT", label: "Likert Scale", desc: "Single-item rating scale" },
      { value: "NUMERIC", label: "Numeric", desc: "Number input with range" },
      { value: "OPEN_TEXT", label: "Open Text", desc: "Free-form text" },
    ],
  },
  {
    category: "Structured",
    types: [
      { value: "AB_TEST", label: "A/B Test", desc: "Compare two options" },
      { value: "RANKING", label: "Ranking", desc: "Tap to rank in order" },
      { value: "MATRIX", label: "Matrix", desc: "Row-by-column grid" },
      { value: "MULTI_ITEM_RATING", label: "Multi-Item Rating", desc: "Rate multiple items" },
    ],
  },
  {
    category: "Specialty",
    types: [
      { value: "SENTIMENT", label: "Sentiment", desc: "Tag with attributes" },
      { value: "REACTION", label: "Reaction", desc: "Rating + multi-select" },
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springForIntent("expand")}
      className="rounded-xl border border-border/60 bg-background shadow-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Add Question</h3>
        <button
          onClick={onCancel}
          className="text-muted-foreground/40 hover:text-foreground p-1 rounded-md hover:bg-accent/50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Phase selector */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider block mb-1.5">
          Phase
        </label>
        <div className="flex gap-1">
          {PHASES.map((p) => (
            <button
              key={p.value}
              onClick={() => setSelectedPhase(p.value)}
              className={`px-2.5 py-1 text-[11px] rounded-lg transition-all duration-150 ${
                selectedPhase === p.value
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type grid */}
      <div className="space-y-3 max-h-80 overflow-y-auto -mx-1 px-1">
        {QUESTION_TYPES.map((category) => (
          <div key={category.category}>
            <p className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-1.5">
              {category.category}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {category.types.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onSelect(type.value, selectedPhase)}
                  className="text-left rounded-lg border border-border/40 p-2.5 hover:border-primary/30 hover:bg-primary/[0.03] transition-all group/type"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground/30 group-hover/type:text-primary/50 transition-colors mt-0.5 shrink-0"
                    >
                      <path d={TYPE_ICONS[type.value] || "M12 6v12M6 12h12"} />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground group-hover/type:text-primary transition-colors">
                        {type.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5 line-clamp-1">
                        {type.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
