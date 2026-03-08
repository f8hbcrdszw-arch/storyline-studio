/**
 * Pure formatting utilities for CSV export — no database dependencies.
 * Extracted from csv-builder.ts for testability.
 */

export function formatAnswerForCsv(
  val: Record<string, unknown>,
  type: string
): string {
  switch (type) {
    case "MULTIPLE_CHOICE": {
      const selected = val.selected;
      return Array.isArray(selected)
        ? selected.join("; ")
        : String(selected || "");
    }
    case "LIKERT":
    case "NUMERIC":
      return String(val.value ?? "");
    case "MULTI_ITEM_RATING": {
      const values = val.values as Record<string, number>;
      if (!values) return "";
      return Object.entries(values)
        .map(([k, v]) => `${k}:${v}`)
        .join("; ");
    }
    case "OPEN_TEXT":
      return String(val.text || "");
    case "AB_TEST":
      return String(val.selected || "");
    case "MATRIX": {
      const values = val.values as Record<string, string>;
      if (!values) return "";
      return Object.entries(values)
        .map(([r, c]) => `${r}:${c}`)
        .join("; ");
    }
    case "RANKING": {
      const ranked = val.ranked;
      return Array.isArray(ranked) ? ranked.join(" > ") : "";
    }
    case "SENTIMENT": {
      const ratings = val.ratings as Record<string, string[]>;
      if (!ratings) return "";
      return Object.entries(ratings)
        .map(([attr, items]) => `${attr}:[${items.join(",")}]`)
        .join("; ");
    }
    case "REACTION": {
      const rating = val.rating;
      const selected = val.selected;
      const parts = [`Rating:${rating}`];
      if (Array.isArray(selected) && selected.length > 0) {
        parts.push(`Selected:${selected.join(",")}`);
      }
      return parts.join("; ");
    }
    default:
      return JSON.stringify(val);
  }
}

export function escapeCsvField(field: string): string {
  if (
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r")
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
