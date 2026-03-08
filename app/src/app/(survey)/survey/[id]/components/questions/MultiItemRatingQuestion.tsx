"use client";

import type { QuestionBodyProps } from "./types";

export default function MultiItemRatingQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const values = (answer as { values: Record<string, number> })?.values || {};
  const scale = (question.config.likertScale as number) || 7;
  const labels = question.config.likertLabels as
    | { low: string; high: string }
    | undefined;

  const items = question.options;

  const setItemValue = (itemValue: string, rating: number) => {
    onChange({ values: { ...values, [itemValue]: rating } });
  };

  return (
    <div className="space-y-4">
      {/* Column header: label spacer + low ... scale numbers ... high */}
      <div className="flex items-center gap-3">
        <span className="w-40 shrink-0" />
        {labels && (
          <span className="text-xs text-muted-foreground shrink-0">{labels.low}</span>
        )}
        <div className="flex gap-1">
          {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
            <div key={n} className="w-11 text-center text-xs text-muted-foreground">
              {n}
            </div>
          ))}
        </div>
        {labels && (
          <span className="text-xs text-muted-foreground shrink-0">{labels.high}</span>
        )}
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="text-sm text-foreground w-40 shrink-0">
            {item.label}
          </span>
          {labels && <span className="w-0 shrink-0" />}
          <div className="flex gap-1">
            {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setItemValue(item.value, n)}
                className={`w-11 h-11 rounded-lg border text-xs font-medium transition-colors ${
                  values[item.value] === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/30 text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
