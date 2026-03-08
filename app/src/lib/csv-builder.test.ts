import { describe, it, expect } from "vitest";
import { formatAnswerForCsv, escapeCsvField } from "./csv-format";

describe("escapeCsvField", () => {
  it("returns plain text unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("wraps field with commas in quotes", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps field with newlines in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("formatAnswerForCsv", () => {
  it("formats MULTIPLE_CHOICE with array", () => {
    expect(
      formatAnswerForCsv({ selected: ["A", "B", "C"] }, "MULTIPLE_CHOICE")
    ).toBe("A; B; C");
  });

  it("formats MULTIPLE_CHOICE with single string", () => {
    expect(
      formatAnswerForCsv({ selected: "Only One" }, "MULTIPLE_CHOICE")
    ).toBe("Only One");
  });

  it("formats LIKERT value", () => {
    expect(formatAnswerForCsv({ value: 4 }, "LIKERT")).toBe("4");
  });

  it("formats NUMERIC value", () => {
    expect(formatAnswerForCsv({ value: 42.5 }, "NUMERIC")).toBe("42.5");
  });

  it("formats OPEN_TEXT", () => {
    expect(formatAnswerForCsv({ text: "Free response here" }, "OPEN_TEXT")).toBe(
      "Free response here"
    );
  });

  it("formats AB_TEST", () => {
    expect(formatAnswerForCsv({ selected: "Option A" }, "AB_TEST")).toBe(
      "Option A"
    );
  });

  it("formats RANKING", () => {
    expect(
      formatAnswerForCsv({ ranked: ["First", "Second", "Third"] }, "RANKING")
    ).toBe("First > Second > Third");
  });

  it("formats MATRIX", () => {
    const result = formatAnswerForCsv(
      { values: { "Row 1": "Col A", "Row 2": "Col B" } },
      "MATRIX"
    );
    expect(result).toContain("Row 1:Col A");
    expect(result).toContain("Row 2:Col B");
  });

  it("formats MULTI_ITEM_RATING", () => {
    const result = formatAnswerForCsv(
      { values: { Quality: 4, Price: 3 } },
      "MULTI_ITEM_RATING"
    );
    expect(result).toContain("Quality:4");
    expect(result).toContain("Price:3");
  });

  it("formats SENTIMENT", () => {
    const result = formatAnswerForCsv(
      { ratings: { positive: ["happy", "excited"], negative: ["bored"] } },
      "SENTIMENT"
    );
    expect(result).toContain("positive:[happy,excited]");
    expect(result).toContain("negative:[bored]");
  });

  it("formats REACTION", () => {
    const result = formatAnswerForCsv(
      { rating: 8, selected: ["surprised", "amused"] },
      "REACTION"
    );
    expect(result).toContain("Rating:8");
    expect(result).toContain("Selected:surprised,amused");
  });

  it("falls back to JSON for unknown types", () => {
    const result = formatAnswerForCsv({ foo: "bar" }, "UNKNOWN_TYPE");
    expect(result).toBe('{"foo":"bar"}');
  });
});
