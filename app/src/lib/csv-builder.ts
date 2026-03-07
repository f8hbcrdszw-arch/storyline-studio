import { prisma } from "@/lib/prisma";

/**
 * Builds a CSV string for a study's completed responses.
 * Rows = respondents, columns = questions.
 * Video dial questions expand to one column per second + lightbulb column.
 */
export async function buildStudyCsv(studyId: string): Promise<string> {
  // Fetch study questions
  const questions = await prisma.question.findMany({
    where: { studyId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      order: true,
    },
  });

  // Fetch completed responses with answers
  const responses = await prisma.response.findMany({
    where: { studyId, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    include: {
      answers: {
        select: {
          questionId: true,
          value: true,
        },
      },
    },
  });

  // For VIDEO_DIAL questions, find max seconds across all dial data
  const dialQuestionIds = questions
    .filter((q) => q.type === "VIDEO_DIAL")
    .map((q) => q.id);

  const dialMaxSeconds: Record<string, number> = {};
  if (dialQuestionIds.length > 0) {
    for (const qId of dialQuestionIds) {
      const maxResult = await prisma.dialDataPoint.aggregate({
        where: { questionId: qId },
        _max: { second: true },
      });
      dialMaxSeconds[qId] = maxResult._max.second ?? 0;
    }
  }

  // Fetch all dial data points for completed responses
  const dialDataByResponse: Record<
    string,
    Record<string, Record<number, number>>
  > = {};
  const lightbulbsByResponse: Record<string, Record<string, number[]>> = {};

  if (dialQuestionIds.length > 0) {
    const responseIds = responses.map((r) => r.id);

    const dialPoints = await prisma.dialDataPoint.findMany({
      where: {
        questionId: { in: dialQuestionIds },
        responseId: { in: responseIds },
      },
      select: {
        responseId: true,
        questionId: true,
        second: true,
        value: true,
      },
    });

    for (const dp of dialPoints) {
      if (!dialDataByResponse[dp.responseId])
        dialDataByResponse[dp.responseId] = {};
      if (!dialDataByResponse[dp.responseId][dp.questionId])
        dialDataByResponse[dp.responseId][dp.questionId] = {};
      dialDataByResponse[dp.responseId][dp.questionId][dp.second] = dp.value;
    }

    const dialEvents = await prisma.dialEvent.findMany({
      where: {
        questionId: { in: dialQuestionIds },
        responseId: { in: responseIds },
        eventType: "lightbulb",
      },
      select: { responseId: true, questionId: true, timestamp: true },
    });

    for (const ev of dialEvents) {
      if (!lightbulbsByResponse[ev.responseId])
        lightbulbsByResponse[ev.responseId] = {};
      if (!lightbulbsByResponse[ev.responseId][ev.questionId])
        lightbulbsByResponse[ev.responseId][ev.questionId] = [];
      lightbulbsByResponse[ev.responseId][ev.questionId].push(
        Number(ev.timestamp)
      );
    }
  }

  // Build header row
  const headers: string[] = ["Response ID", "Started At", "Completed At"];

  const questionColumns: {
    questionId: string;
    type: string;
    maxSecond?: number;
  }[] = [];

  for (const q of questions) {
    if (q.type === "VIDEO_DIAL") {
      const maxSec = dialMaxSeconds[q.id] || 0;
      for (let s = 0; s <= maxSec; s++) {
        headers.push(`Q${q.order + 1} Dial s${s}`);
      }
      headers.push(`Q${q.order + 1} Lightbulbs`);
      questionColumns.push({
        questionId: q.id,
        type: q.type,
        maxSecond: maxSec,
      });
    } else {
      headers.push(`Q${q.order + 1}: ${q.title}`);
      questionColumns.push({ questionId: q.id, type: q.type });
    }
  }

  // Build rows
  const rows: string[][] = [headers];

  for (const response of responses) {
    const row: string[] = [
      response.respondentId,
      response.startedAt.toISOString(),
      response.completedAt?.toISOString() || "",
    ];

    const answerMap = Object.fromEntries(
      response.answers.map((a) => [a.questionId, a.value])
    );

    for (const col of questionColumns) {
      if (col.type === "VIDEO_DIAL") {
        const maxSec = col.maxSecond || 0;
        const dialData =
          dialDataByResponse[response.id]?.[col.questionId] || {};
        for (let s = 0; s <= maxSec; s++) {
          row.push(dialData[s] !== undefined ? String(dialData[s]) : "");
        }
        const lbs =
          lightbulbsByResponse[response.id]?.[col.questionId] || [];
        row.push(
          lbs.length > 0 ? lbs.map((t) => t.toFixed(1)).join(";") : ""
        );
      } else {
        const val = answerMap[col.questionId] as Record<string, unknown>;
        row.push(val ? formatAnswerForCsv(val, col.type) : "");
      }
    }

    rows.push(row);
  }

  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function formatAnswerForCsv(
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

function escapeCsvField(field: string): string {
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
