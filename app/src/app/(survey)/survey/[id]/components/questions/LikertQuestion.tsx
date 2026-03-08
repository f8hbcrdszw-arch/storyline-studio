"use client";

import type { QuestionBodyProps } from "./types";

export default function LikertQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const currentValue = (answer as { value: number })?.value;
  const scale = (question.config.likertScale as number) || 7;
  const labels = question.config.likertLabels as
    | { low: string; high: string }
    | undefined;

  return (
    <div className="flex items-center justify-center gap-3">
      {labels && (
        <span className="text-xs text-muted-foreground shrink-0">{labels.low}</span>
      )}
      <div className="flex gap-2 flex-wrap justify-center">
        {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange({ value: n })}
            className={`w-11 h-11 rounded-lg border text-sm font-medium transition-colors ${
              currentValue === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/30 text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <span className="text-xs text-muted-foreground shrink-0">{labels.high}</span>
      )}
    </div>
  );
}
