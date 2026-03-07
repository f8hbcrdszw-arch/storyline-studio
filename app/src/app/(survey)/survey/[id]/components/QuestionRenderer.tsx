"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { VideoDial } from "./video-dial/VideoDial";
import type { SurveyQuestion } from "./SurveyShell";

// ─────────────────────────────────────────────────────────────────────────────
// Respondent-facing question type components
// ─────────────────────────────────────────────────────────────────────────────

export function QuestionRenderer({
  question,
  existingAnswer,
  onSubmit,
  onBack,
  loading,
}: {
  question: SurveyQuestion;
  existingAnswer: unknown;
  onSubmit: (value: unknown) => void;
  onBack?: () => void;
  loading: boolean;
}) {
  const [answer, setAnswer] = useState<unknown>(existingAnswer ?? null);

  const handleSubmit = useCallback(() => {
    if (answer !== null) {
      onSubmit(answer);
    }
  }, [answer, onSubmit]);

  const isValid = answer !== null && answer !== undefined;

  // VIDEO_DIAL has its own submit flow (video must finish first)
  if (question.type === "VIDEO_DIAL") {
    return (
      <div className="space-y-6">
        <div>
          <h2>{question.title}</h2>
          {question.prompt && (
            <p className="text-sm text-muted-foreground mt-1">
              {question.prompt}
            </p>
          )}
        </div>
        <VideoDial question={question} onSubmit={onSubmit} loading={loading} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Question header */}
      <div>
        <h2>{question.title}</h2>
        {question.prompt && (
          <p className="text-sm text-muted-foreground mt-1">
            {question.prompt}
          </p>
        )}
      </div>

      {/* Question body — type-specific */}
      <div className="min-h-[200px]">
        <QuestionBody
          question={question}
          answer={answer}
          onChange={setAnswer}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={loading}>
            &larr; Back
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={handleSubmit}
          disabled={loading || (question.required && !isValid)}
        >
          {loading ? "Saving..." : "Next"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific question body components
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBody({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return (
        <MultipleChoiceQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "LIKERT":
      return (
        <LikertQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "MULTI_ITEM_RATING":
      return (
        <MultiItemRatingQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "NUMERIC":
      return (
        <NumericQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "OPEN_TEXT":
      return (
        <OpenTextQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "AB_TEST":
      return (
        <ABTestQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "MATRIX":
      return (
        <MatrixQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "RANKING":
      return (
        <RankingQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "SENTIMENT":
      return (
        <SentimentQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "REACTION":
      return (
        <ReactionQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "VIDEO_DIAL":
      // Handled directly in QuestionRenderer (has its own submit flow)
      return null;
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unsupported question type: {question.type}
        </p>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Choice (list, bubbles, images display styles)
// ─────────────────────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Likert scale
// ─────────────────────────────────────────────────────────────────────────────

function LikertQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const currentValue = (answer as { value: number })?.value;
  const scale = (question.config.likertScale as number) || 7;
  const labels = question.config.likertLabels as
    | { low: string; high: string }
    | undefined;

  return (
    <div className="space-y-3">
      {labels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{labels.low}</span>
          <span>{labels.high}</span>
        </div>
      )}
      <div className="flex gap-2 justify-center flex-wrap">
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Item Rating
// ─────────────────────────────────────────────────────────────────────────────

function MultiItemRatingQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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
      {labels && (
        <div className="flex justify-end gap-2 text-xs text-muted-foreground">
          <span>{labels.low}</span>
          <div style={{ width: `${scale * 2.75}rem` }} />
          <span>{labels.high}</span>
        </div>
      )}
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="text-sm text-foreground w-40 shrink-0">
            {item.label}
          </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Numeric
// ─────────────────────────────────────────────────────────────────────────────

function NumericQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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
          onChange({ value: e.target.value ? Number(e.target.value) : undefined })
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

// ─────────────────────────────────────────────────────────────────────────────
// Open Text
// ─────────────────────────────────────────────────────────────────────────────

function OpenTextQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// A/B Test
// ─────────────────────────────────────────────────────────────────────────────

function ABTestQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Matrix
// ─────────────────────────────────────────────────────────────────────────────

function MatrixQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const values = (answer as { values: Record<string, string> })?.values || {};
  const rows =
    (question.config.rows as { id: string; label: string }[]) || [];
  const columns =
    (question.config.columns as { id: string; label: string }[]) || [];

  const setCell = (rowId: string, colId: string) => {
    onChange({ values: { ...values, [rowId]: colId } });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2" />
            {columns.map((col) => (
              <th
                key={col.id}
                className="p-2 text-center text-xs text-muted-foreground font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-2 text-foreground">{row.label}</td>
              {columns.map((col) => (
                <td key={col.id} className="p-2 text-center">
                  <button
                    onClick={() => setCell(row.id, col.id)}
                    className={`w-8 h-8 rounded-full border transition-colors ${
                      values[row.id] === col.id
                        ? "border-primary bg-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                    aria-label={`${row.label}: ${col.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────────────

function RankingQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Sentiment (configurable attributes — replaces Ad Mock-Up + Multi-Ad)
// ─────────────────────────────────────────────────────────────────────────────

function SentimentQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
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

  // Color palette for attributes
  const attrColors = [
    { border: "border-green-500", bg: "bg-green-50", text: "text-green-700", hover: "hover:border-green-300" },
    { border: "border-red-500", bg: "bg-red-50", text: "text-red-700", hover: "hover:border-red-300" },
    { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-700", hover: "hover:border-blue-300" },
    { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-700", hover: "hover:border-amber-300" },
    { border: "border-purple-500", bg: "bg-purple-50", text: "text-purple-700", hover: "hover:border-purple-300" },
  ];

  return (
    <div className="space-y-4">
      {attributes.map((attr, attrIdx) => {
        const colors = attrColors[attrIdx % attrColors.length];
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

// ─────────────────────────────────────────────────────────────────────────────
// Reaction (rating + multi-select — replaces Overall Reaction)
// ─────────────────────────────────────────────────────────────────────────────

function ReactionQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const current = (answer as {
    rating: number;
    selected: string[];
    annotation?: string;
  }) || { rating: 0, selected: [] };

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
