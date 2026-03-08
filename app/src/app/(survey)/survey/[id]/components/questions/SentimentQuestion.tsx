"use client";

import type { QuestionBodyProps } from "./types";

const ATTR_COLORS = [
  { border: "border-green-500", bg: "bg-green-50", text: "text-green-700", hover: "hover:border-green-300" },
  { border: "border-red-500", bg: "bg-red-50", text: "text-red-700", hover: "hover:border-red-300" },
  { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-700", hover: "hover:border-blue-300" },
  { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-700", hover: "hover:border-amber-300" },
  { border: "border-purple-500", bg: "bg-purple-50", text: "text-purple-700", hover: "hover:border-purple-300" },
];

export default function SentimentQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const current = (answer as { ratings: Record<string, string[]> }) || {
    ratings: {},
  };
  const ratings = current.ratings || {};
  const attributes =
    (question.config.attributes as string[]) || ["Positive", "Negative"];

  const toggleItem = (attribute: string, value: string) => {
    const arr = ratings[attribute] || [];
    const updated = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    onChange({ ratings: { ...ratings, [attribute]: updated } });
  };

  return (
    <div className="space-y-4">
      {attributes.map((attr, attrIdx) => {
        const colors = ATTR_COLORS[attrIdx % ATTR_COLORS.length];
        return (
          <div key={attr}>
            <p className="text-sm font-medium text-foreground mb-2">{attr}</p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleItem(attr, opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                    ratings[attr]?.includes(opt.value)
                      ? `${colors.border} ${colors.bg} ${colors.text}`
                      : `border-border text-foreground ${colors.hover}`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
