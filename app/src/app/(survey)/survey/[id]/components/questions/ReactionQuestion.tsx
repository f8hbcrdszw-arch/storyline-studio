"use client";

import type { QuestionBodyProps } from "./types";

export default function ReactionQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const current = (answer as {
    rating: number;
    selected: string[];
    annotation?: string;
  }) || { rating: null, selected: [] };

  const scale = (question.config.likertScale as number) || 7;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Overall Rating
        </p>
        <div className="flex gap-2 justify-center">
          {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...current, rating: n })}
              className={`w-11 h-11 rounded-lg border text-sm font-medium transition-colors ${
                current.rating === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/30 text-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {question.options.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Select all that apply
          </p>
          <div className="flex flex-wrap gap-2">
            {question.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  const selected = current.selected || [];
                  const updated = selected.includes(opt.value)
                    ? selected.filter((s) => s !== opt.value)
                    : [...selected, opt.value];
                  onChange({ ...current, selected: updated });
                }}
                className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                  current.selected?.includes(opt.value)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
