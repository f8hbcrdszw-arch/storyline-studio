import { describe, it, expect } from "vitest";
import { answerSchemaByType, submitAnswerSchema, createResponseSchema } from "./answer";

describe("answerSchemaByType", () => {
  it("validates MULTIPLE_CHOICE answer", () => {
    const schema = answerSchemaByType.MULTIPLE_CHOICE;
    expect(schema.safeParse({ selected: ["A"] }).success).toBe(true);
    expect(schema.safeParse({ selected: [] }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("validates LIKERT answer", () => {
    const schema = answerSchemaByType.LIKERT;
    expect(schema.safeParse({ value: 3 }).success).toBe(true);
    expect(schema.safeParse({ value: 0 }).success).toBe(false);
    expect(schema.safeParse({ value: 12 }).success).toBe(false);
  });

  it("validates OPEN_TEXT answer", () => {
    const schema = answerSchemaByType.OPEN_TEXT;
    expect(schema.safeParse({ text: "Hello" }).success).toBe(true);
    expect(schema.safeParse({ text: "" }).success).toBe(false);
  });

  it("validates NUMERIC answer", () => {
    const schema = answerSchemaByType.NUMERIC;
    expect(schema.safeParse({ value: 42.5 }).success).toBe(true);
    expect(schema.safeParse({ value: "not a number" }).success).toBe(false);
  });

  it("validates AB_TEST answer", () => {
    const schema = answerSchemaByType.AB_TEST;
    expect(schema.safeParse({ selected: "A" }).success).toBe(true);
    expect(schema.safeParse({ selected: "A", annotation: "reason" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("validates RANKING answer", () => {
    const schema = answerSchemaByType.RANKING;
    expect(schema.safeParse({ ranked: ["A", "B", "C"] }).success).toBe(true);
    expect(schema.safeParse({ ranked: [] }).success).toBe(false);
  });

  it("validates MATRIX answer", () => {
    const schema = answerSchemaByType.MATRIX;
    expect(schema.safeParse({ values: { "Row 1": "Col A" } }).success).toBe(true);
  });

  it("validates MULTI_ITEM_RATING answer", () => {
    const schema = answerSchemaByType.MULTI_ITEM_RATING;
    expect(schema.safeParse({ values: { Quality: 4 } }).success).toBe(true);
    expect(schema.safeParse({ values: { Quality: 0 } }).success).toBe(false);
  });

  it("validates VIDEO_DIAL answer", () => {
    const schema = answerSchemaByType.VIDEO_DIAL;
    expect(
      schema.safeParse({
        feedback: { "0": 50, "1": 60 },
        lightbulbs: [1.5, 3.2],
        sliderInteracted: true,
      }).success
    ).toBe(true);
  });

  it("validates SENTIMENT answer", () => {
    const schema = answerSchemaByType.SENTIMENT;
    expect(
      schema.safeParse({
        ratings: { positive: ["happy"], negative: ["sad"] },
      }).success
    ).toBe(true);
  });

  it("validates REACTION answer", () => {
    const schema = answerSchemaByType.REACTION;
    expect(
      schema.safeParse({
        rating: 5,
        selected: ["surprised"],
      }).success
    ).toBe(true);
  });
});

describe("submitAnswerSchema", () => {
  it("accepts valid submission", () => {
    expect(
      submitAnswerSchema.safeParse({
        responseId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "550e8400-e29b-41d4-a716-446655440001",
        value: { selected: ["A"] },
      }).success
    ).toBe(true);
  });

  it("rejects non-UUID responseId", () => {
    expect(
      submitAnswerSchema.safeParse({
        responseId: "not-a-uuid",
        questionId: "550e8400-e29b-41d4-a716-446655440001",
        value: {},
      }).success
    ).toBe(false);
  });
});

describe("createResponseSchema", () => {
  it("accepts valid request", () => {
    expect(
      createResponseSchema.safeParse({
        studyId: "550e8400-e29b-41d4-a716-446655440000",
      }).success
    ).toBe(true);
  });

  it("accepts with optional turnstile token", () => {
    expect(
      createResponseSchema.safeParse({
        studyId: "550e8400-e29b-41d4-a716-446655440000",
        turnstileToken: "some-token",
      }).success
    ).toBe(true);
  });
});
