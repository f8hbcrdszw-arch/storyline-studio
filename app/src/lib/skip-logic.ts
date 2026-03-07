import type { SkipLogicRule } from "@/lib/types/json-fields";

/**
 * Evaluates a single skip logic rule against a given answer value.
 */
function evaluateCondition(
  rule: SkipLogicRule,
  answerValue: unknown
): boolean {
  const target = String(rule.value);

  // Extract comparable value from answer object
  let actual: string;
  if (typeof answerValue === "object" && answerValue !== null) {
    const obj = answerValue as Record<string, unknown>;
    // Handle list-type answers
    if (Array.isArray(obj.selected)) {
      const selectedArr = obj.selected as string[];
      switch (rule.operator) {
        case "equals":
          return selectedArr.includes(target);
        case "not_equals":
          return !selectedArr.includes(target);
        case "contains":
          return selectedArr.some((s) =>
            String(s).toLowerCase().includes(target.toLowerCase())
          );
        default:
          return false;
      }
    }
    // Handle single value answers (likert, numeric, etc.)
    if ("value" in obj) {
      actual = String(obj.value);
    } else if ("selected" in obj && typeof obj.selected === "string") {
      actual = obj.selected;
    } else if ("text" in obj) {
      actual = String(obj.text);
    } else if ("rating" in obj) {
      actual = String(obj.rating);
    } else {
      return false;
    }
  } else {
    actual = String(answerValue);
  }

  switch (rule.operator) {
    case "equals":
      return actual === target;
    case "not_equals":
      return actual !== target;
    case "contains":
      return actual.toLowerCase().includes(target.toLowerCase());
    case "gt":
      return Number(actual) > Number(target);
    case "lt":
      return Number(actual) < Number(target);
    default:
      return false;
  }
}

/**
 * Evaluates skip logic rules for a question against collected answers.
 * Returns the result: screen out, skip to a specific question, or continue normally.
 */
export function evaluateSkipLogic(
  rules: SkipLogicRule[] | null | undefined,
  answers: Record<string, unknown>
): { screenOut: boolean; skipToQuestionId?: string } | null {
  if (!rules || rules.length === 0) return null;

  for (const rule of rules) {
    const answer = answers[rule.questionId];
    if (answer === undefined) continue;

    if (evaluateCondition(rule, answer)) {
      if (rule.screenOut) {
        return { screenOut: true };
      }
      if (rule.skipToQuestionId) {
        return { screenOut: false, skipToQuestionId: rule.skipToQuestionId };
      }
    }
  }

  return null;
}
