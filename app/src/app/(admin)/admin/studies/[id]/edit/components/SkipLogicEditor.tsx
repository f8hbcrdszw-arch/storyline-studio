"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionData } from "./StudyEditor";

interface SkipLogicRule {
  questionId: string;
  operator: string;
  value: string;
  skipToQuestionId?: string;
  screenOut?: boolean;
}

export function SkipLogicEditor({
  question,
  allQuestions,
  onUpdate,
  isLocked,
}: {
  question: QuestionData;
  allQuestions: QuestionData[];
  onUpdate: (skipLogic: SkipLogicRule[] | null) => void;
  isLocked: boolean;
}) {
  const rules = (question.skipLogic as unknown as SkipLogicRule[]) || [];

  // Questions that come before this one (for "if answer to Q[x]" conditions)
  const previousQuestions = allQuestions.filter(
    (q) => q.order < question.order
  );

  // Questions that come after this one (for "skip to Q[y]" targets)
  const laterQuestions = allQuestions.filter(
    (q) => q.order > question.order
  );

  const addRule = useCallback(() => {
    const newRules: SkipLogicRule[] = [
      ...rules,
      {
        questionId: previousQuestions[0]?.id || "",
        operator: "equals",
        value: "",
        screenOut: false,
      },
    ];
    onUpdate(newRules);
  }, [rules, previousQuestions, onUpdate]);

  const updateRule = useCallback(
    (index: number, updates: Partial<SkipLogicRule>) => {
      const newRules = rules.map((r, i) =>
        i === index ? { ...r, ...updates } : r
      );
      onUpdate(newRules);
    },
    [rules, onUpdate]
  );

  const removeRule = useCallback(
    (index: number) => {
      const newRules = rules.filter((_, i) => i !== index);
      onUpdate(newRules.length > 0 ? newRules : null);
    },
    [rules, onUpdate]
  );

  if (previousQuestions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Skip logic requires at least one previous question.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground block">
        Skip Logic
      </label>

      {rules.map((rule, i) => (
        <div
          key={i}
          className="rounded border border-border p-2 space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">If answer to</span>
            <select
              value={rule.questionId}
              onChange={(e) =>
                updateRule(i, { questionId: e.target.value })
              }
              disabled={isLocked}
              className="rounded border border-input bg-background px-1 py-0.5 text-xs"
            >
              <option value="">Select question...</option>
              {previousQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  Q{q.order + 1}: {q.title.slice(0, 30)}
                </option>
              ))}
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(i, { operator: e.target.value })}
              disabled={isLocked}
              className="rounded border border-input bg-background px-1 py-0.5 text-xs"
            >
              <option value="equals">equals</option>
              <option value="not_equals">does not equal</option>
              <option value="contains">contains</option>
              <option value="gt">greater than</option>
              <option value="lt">less than</option>
            </select>
            <input
              type="text"
              value={rule.value}
              onChange={(e) => updateRule(i, { value: e.target.value })}
              disabled={isLocked}
              placeholder="Value"
              className="w-32 rounded border border-input bg-background px-1 py-0.5 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={rule.screenOut || false}
                onChange={(e) =>
                  updateRule(i, {
                    screenOut: e.target.checked,
                    skipToQuestionId: e.target.checked
                      ? undefined
                      : rule.skipToQuestionId,
                  })
                }
                disabled={isLocked}
                className="rounded"
              />
              Screen out
            </label>

            {!rule.screenOut && (
              <>
                <span className="text-muted-foreground">then skip to</span>
                <select
                  value={rule.skipToQuestionId || ""}
                  onChange={(e) =>
                    updateRule(i, {
                      skipToQuestionId: e.target.value || undefined,
                    })
                  }
                  disabled={isLocked}
                  className="rounded border border-input bg-background px-1 py-0.5 text-xs"
                >
                  <option value="">Select question...</option>
                  {laterQuestions.map((q) => (
                    <option key={q.id} value={q.id}>
                      Q{q.order + 1}: {q.title.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </>
            )}

            {!isLocked && (
              <button
                onClick={() => removeRule(i)}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      {!isLocked && (
        <button onClick={addRule} className="text-xs text-primary hover:underline">
          + Add skip logic rule
        </button>
      )}
    </div>
  );
}
