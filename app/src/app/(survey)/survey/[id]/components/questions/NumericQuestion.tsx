"use client";

import type { QuestionBodyProps } from "./types";

export default function NumericQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const currentValue = (answer as { value: number })?.value ?? "";
  const min = question.config.minValue as number | undefined;
  const max = question.config.maxValue as number | undefined;
  const step = question.config.step as number | undefined;

  return (
    <div>
      <input
        type="number"
        value={currentValue}
        onChange={(e) =>
          onChange(e.target.value ? { value: Number(e.target.value) } : null)
        }
        min={min}
        max={max}
        step={step}
        className="w-full max-w-xs rounded-lg border border-input bg-background px-4 py-3 text-lg"
        placeholder="Enter a number"
      />
      {(min !== undefined || max !== undefined) && (
        <p className="text-xs text-muted-foreground mt-1">
          {min !== undefined && max !== undefined
            ? `Between ${min} and ${max}`
            : min !== undefined
              ? `Minimum: ${min}`
              : `Maximum: ${max}`}
        </p>
      )}
    </div>
  );
}
