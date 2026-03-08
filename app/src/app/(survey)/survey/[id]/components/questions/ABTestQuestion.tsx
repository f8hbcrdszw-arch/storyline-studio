"use client";

import type { QuestionBodyProps } from "./types";

export default function ABTestQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const selected = (answer as { selected: string })?.selected || "";
  const options = question.options;
  const hasImages = options.some((opt) => opt.imageUrl);

  if (options.length < 2) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {options.slice(0, 2).map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange({ selected: opt.value })}
          className={`rounded-lg border p-4 transition-colors min-h-[100px] flex flex-col items-center justify-center ${
            selected === opt.value
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/30"
          }`}
        >
          {hasImages && opt.imageUrl && (
            <img
              src={opt.imageUrl}
              alt=""
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          <span className="text-sm font-medium text-foreground">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
