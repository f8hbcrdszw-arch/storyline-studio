"use client";

import type { QuestionBodyProps } from "./types";

export default function MultipleChoiceQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const selected = (answer as { selected: string[] })?.selected || [];
  const maxSelect = (question.config.maxSelect as number) || 1;
  const isMulti = maxSelect > 1;
  const displayStyle = (question.config.displayStyle as string) || "list";

  const toggle = (value: string) => {
    if (isMulti) {
      const updated = selected.includes(value)
        ? selected.filter((s) => s !== value)
        : [...selected, value].slice(0, maxSelect);
      onChange({ selected: updated });
    } else {
      onChange({ selected: [value] });
    }
  };

  if (displayStyle === "bubbles") {
    return (
      <div className="space-y-2">
        {isMulti && (
          <p className="text-xs text-muted-foreground">
            Select up to {maxSelect}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggle(opt.value)}
              className={`rounded-full px-4 py-2 text-sm border transition-colors ${
                selected.includes(opt.value)
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-foreground hover:border-primary/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (displayStyle === "images") {
    return (
      <div className="space-y-2">
        {isMulti && (
          <p className="text-xs text-muted-foreground">
            Select up to {maxSelect}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggle(opt.value)}
              className={`rounded-lg border p-2 transition-colors ${
                selected.includes(opt.value)
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/30"
              }`}
            >
              {opt.imageUrl && (
                <img
                  src={opt.imageUrl}
                  alt=""
                  className="w-full h-24 object-cover rounded mb-2"
                />
              )}
              <span className="text-sm text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default: list display
  return (
    <div className="space-y-2">
      {isMulti && (
        <p className="text-xs text-muted-foreground">
          Select up to {maxSelect}
        </p>
      )}
      {question.options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.value)}
          className={`w-full text-left rounded-lg border p-3 transition-colors min-h-[44px] ${
            selected.includes(opt.value)
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border hover:border-primary/30 text-foreground"
          }`}
        >
          <span className="text-sm">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
