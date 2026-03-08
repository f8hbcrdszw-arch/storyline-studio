import { describe, it, expect } from "vitest";
import { evaluateSkipLogic } from "./skip-logic";
import type { SkipLogicRule } from "@/lib/types/json-fields";

describe("evaluateSkipLogic", () => {
  it("returns null when rules are empty", () => {
    expect(evaluateSkipLogic([], {})).toBeNull();
    expect(evaluateSkipLogic(null, {})).toBeNull();
    expect(evaluateSkipLogic(undefined, {})).toBeNull();
  });

  it("returns null when answer for rule question is missing", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "yes", screenOut: true },
    ];
    expect(evaluateSkipLogic(rules, {})).toBeNull();
  });

  // equals operator
  it("matches equals on single-value answer", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "3", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, { q1: { value: 3 } });
    expect(result).toEqual({ screenOut: true });
  });

  it("does not match equals when value differs", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "3", screenOut: true },
    ];
    expect(evaluateSkipLogic(rules, { q1: { value: 5 } })).toBeNull();
  });

  // not_equals operator
  it("matches not_equals when value differs", () => {
    const rules: SkipLogicRule[] = [
      {
        questionId: "q1",
        operator: "not_equals",
        value: "yes",
        skipToQuestionId: "q5",
      },
    ];
    const result = evaluateSkipLogic(rules, { q1: { selected: "no" } });
    expect(result).toEqual({ screenOut: false, skipToQuestionId: "q5" });
  });

  // contains operator
  it("matches contains on text answer", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "contains", value: "hello", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, { q1: { text: "say Hello world" } });
    expect(result).toEqual({ screenOut: true });
  });

  // gt / lt operators
  it("matches gt on numeric answer", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "gt", value: "10", skipToQuestionId: "q3" },
    ];
    const result = evaluateSkipLogic(rules, { q1: { value: 15 } });
    expect(result).toEqual({ screenOut: false, skipToQuestionId: "q3" });
  });

  it("does not match gt when value is equal", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "gt", value: "10", screenOut: true },
    ];
    expect(evaluateSkipLogic(rules, { q1: { value: 10 } })).toBeNull();
  });

  it("matches lt on numeric answer", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "lt", value: "5", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, { q1: { value: 3 } });
    expect(result).toEqual({ screenOut: true });
  });

  // Array-based answers (multiple choice)
  it("matches equals on array-selected answer", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "Option B", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, {
      q1: { selected: ["Option A", "Option B"] },
    });
    expect(result).toEqual({ screenOut: true });
  });

  it("matches not_equals when value not in array", () => {
    const rules: SkipLogicRule[] = [
      {
        questionId: "q1",
        operator: "not_equals",
        value: "Option C",
        skipToQuestionId: "q4",
      },
    ];
    const result = evaluateSkipLogic(rules, {
      q1: { selected: ["Option A", "Option B"] },
    });
    expect(result).toEqual({ screenOut: false, skipToQuestionId: "q4" });
  });

  // Reaction-type answer (has rating field)
  it("matches on reaction answer with rating", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "5", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, { q1: { rating: 5 } });
    expect(result).toEqual({ screenOut: true });
  });

  // Multiple rules — first match wins
  it("returns first matching rule", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "yes", skipToQuestionId: "q3" },
      { questionId: "q1", operator: "equals", value: "no", screenOut: true },
    ];
    const result = evaluateSkipLogic(rules, { q1: { selected: "no" } });
    expect(result).toEqual({ screenOut: true });
  });

  // Skip when no screenOut or skipToQuestionId
  it("returns null when condition matches but no action defined", () => {
    const rules: SkipLogicRule[] = [
      { questionId: "q1", operator: "equals", value: "yes" },
    ];
    expect(evaluateSkipLogic(rules, { q1: { selected: "yes" } })).toBeNull();
  });
});
