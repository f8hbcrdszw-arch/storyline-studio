"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div>
        <h2 className="text-lg font-medium text-foreground">
          {question.title}
        </h2>
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
    case "STANDARD_LIST":
    case "WORD_LIST":
    case "IMAGE_LIST":
      return (
        <ListQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "LIKERT":
      return (
        <LikertQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "MULTI_LIKERT":
      return (
        <MultiLikertQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "NUMERIC":
      return (
        <NumericQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "WRITE_IN":
    case "CREATIVE_COPY":
      return (
        <WriteInQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "TEXT_AB":
    case "IMAGE_AB":
      return (
        <ABQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "GRID":
      return (
        <GridQuestion question={question} answer={answer} onChange={onChange} />
      );
    case "LIST_RANKING":
      return (
        <RankingQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "COMPARISON":
      return (
        <ComparisonQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "AD_MOCK_UP":
      return (
        <AdMockUpQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "OVERALL_REACTION":
      return (
        <OverallReactionQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "SELECT_FROM_SET":
      return (
        <SelectFromSetQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "MULTI_AD":
      return (
        <MultiAdQuestion
          question={question}
          answer={answer}
          onChange={onChange}
        />
      );
    case "VIDEO_DIAL":
      return (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Video dial testing will be available in Phase 4.
          </p>
        </div>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unsupported question type: {question.type}
        </p>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// List types (STANDARD_LIST, WORD_LIST, IMAGE_LIST)
// ─────────────────────────────────────────────────────────────────────────────

function ListQuestion({
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
          <div className="flex items-center gap-3">
            {question.type === "IMAGE_LIST" && opt.imageUrl && (
              <img
                src={opt.imageUrl}
                alt=""
                className="w-12 h-12 object-cover rounded"
              />
            )}
            <span className="text-sm">{opt.label}</span>
          </div>
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
// Multi-item Likert
// ─────────────────────────────────────────────────────────────────────────────

function MultiLikertQuestion({
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
                className={`w-9 h-9 rounded border text-xs font-medium transition-colors ${
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
// Write-in / Creative Copy
// ─────────────────────────────────────────────────────────────────────────────

function WriteInQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const isCreativeCopy = question.type === "CREATIVE_COPY";
  const text = isCreativeCopy
    ? ((answer as { annotations: string[] })?.annotations?.[0] || "")
    : ((answer as { text: string })?.text || "");

  return (
    <textarea
      value={text}
      onChange={(e) =>
        isCreativeCopy
          ? onChange({ annotations: [e.target.value] })
          : onChange({ text: e.target.value })
      }
      rows={4}
      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm resize-none"
      placeholder="Type your response..."
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A/B comparison (TEXT_AB, IMAGE_AB)
// ─────────────────────────────────────────────────────────────────────────────

function ABQuestion({
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
          {question.type === "IMAGE_AB" && opt.imageUrl && (
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
// Grid (matrix)
// ─────────────────────────────────────────────────────────────────────────────

function GridQuestion({
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
// List Ranking
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
// Comparison
// ─────────────────────────────────────────────────────────────────────────────

function ComparisonQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const values = (answer as { values: Record<string, string> })?.values || {};
  const options = question.options;

  // Comparison pairs: show options in pairs for side-by-side comparison
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <div
          key={opt.id}
          className="flex items-center gap-3 rounded-lg border border-border p-3"
        >
          <span className="text-sm text-foreground flex-1">{opt.label}</span>
          <select
            value={values[opt.value] || ""}
            onChange={(e) =>
              onChange({ values: { ...values, [opt.value]: e.target.value } })
            }
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Rate...</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad Mock-Up
// ─────────────────────────────────────────────────────────────────────────────

function AdMockUpQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const current = (answer as {
    positive: string[];
    negative: string[];
    posAnnotation?: string;
    negAnnotation?: string;
  }) || { positive: [], negative: [] };

  const toggleItem = (
    list: "positive" | "negative",
    value: string
  ) => {
    const arr = current[list] || [];
    const updated = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    onChange({ ...current, [list]: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          What did you like?
        </p>
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggleItem("positive", opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                current.positive?.includes(opt.value)
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border text-foreground hover:border-green-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          What did you dislike?
        </p>
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggleItem("negative", opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                current.negative?.includes(opt.value)
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-border text-foreground hover:border-red-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overall Reaction
// ─────────────────────────────────────────────────────────────────────────────

function OverallReactionQuestion({
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

// ─────────────────────────────────────────────────────────────────────────────
// Select From Set
// ─────────────────────────────────────────────────────────────────────────────

function SelectFromSetQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const selected =
    (answer as { selected: Record<string, string> })?.selected || {};
  const sets =
    (question.config.sets as { id: string; label: string; options: string[] }[]) ||
    [];

  return (
    <div className="space-y-4">
      {sets.map((set) => (
        <div key={set.id}>
          <p className="text-sm font-medium text-foreground mb-2">
            {set.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {set.options.map((opt) => (
              <button
                key={opt}
                onClick={() =>
                  onChange({
                    selected: { ...selected, [set.id]: opt },
                  })
                }
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selected[set.id] === opt
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-primary/30 text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Ad
// ─────────────────────────────────────────────────────────────────────────────

function MultiAdQuestion({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: unknown;
  onChange: (value: unknown) => void;
}) {
  const selected =
    (answer as { selected: Record<string, string[]> })?.selected || {};

  // Multi-Ad: each option can be assigned multiple attribute tags
  const toggleAttribute = (optionValue: string, attr: string) => {
    const current = selected[optionValue] || [];
    const updated = current.includes(attr)
      ? current.filter((a) => a !== attr)
      : [...current, attr];
    onChange({
      selected: { ...selected, [optionValue]: updated },
    });
  };

  const attributes = ["Memorable", "Convincing", "Relevant", "Unique"];

  return (
    <div className="space-y-4">
      {question.options.map((opt) => (
        <div key={opt.id} className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground mb-2">
            {opt.label}
          </p>
          <div className="flex flex-wrap gap-1">
            {attributes.map((attr) => (
              <button
                key={attr}
                onClick={() => toggleAttribute(opt.value, attr)}
                className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                  selected[opt.value]?.includes(attr)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {attr}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
