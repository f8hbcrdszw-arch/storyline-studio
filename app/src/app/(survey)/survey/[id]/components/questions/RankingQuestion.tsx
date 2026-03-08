"use client";

import type { QuestionBodyProps } from "./types";

export default function RankingQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const ranked = (answer as { ranked: string[] })?.ranked || [];
  const unranked = question.options.filter(
    (opt) => !ranked.includes(opt.value)
  );

  const addToRank = (value: string) => {
    onChange({ ranked: [...ranked, value] });
  };

  const removeFromRank = (value: string) => {
    onChange({ ranked: ranked.filter((v) => v !== value) });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tap items in order of preference (1 = most preferred)
      </p>

      {/* Ranked items */}
      {ranked.length > 0 && (
        <div className="space-y-1">
          {ranked.map((value, i) => {
            const opt = question.options.find((o) => o.value === value);
            return (
              <div
                key={value}
                className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3"
              >
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground flex-1">
                  {opt?.label || value}
                </span>
                <button
                  onClick={() => removeFromRank(value)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Unranked items */}
      {unranked.length > 0 && (
        <div className="space-y-1">
          {unranked.map((opt) => (
            <button
              key={opt.id}
              onClick={() => addToRank(opt.value)}
              className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/30 transition-colors min-h-[44px]"
            >
              <span className="text-sm text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
