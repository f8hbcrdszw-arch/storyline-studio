"use client";

import type { QuestionBodyProps } from "./types";

export default function OpenTextQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const text = (answer as { text: string })?.text || "";
  const placeholder = (question.config.placeholder as string) || "Type your response...";

  return (
    <textarea
      value={text}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={4}
      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm resize-none"
      placeholder={placeholder}
    />
  );
}
