import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Study overview stats
// ─────────────────────────────────────────────────────────────────────────────

export interface StudyOverviewStats {
  totalResponses: number;
  completed: number;
  screenedOut: number;
  inProgress: number;
  abandoned: number;
  completionRate: number;
  screenOutRate: number;
  avgCompletionTimeSecs: number | null;
}

export async function getStudyOverviewStats(
  studyId: string
): Promise<StudyOverviewStats> {
  const responses = await prisma.response.groupBy({
    by: ["status"],
    where: { studyId },
    _count: true,
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of responses) {
    counts[r.status] = r._count;
    total += r._count;
  }

  const completed = counts["COMPLETED"] || 0;
  const screenedOut = counts["SCREENED_OUT"] || 0;

  // Calculate average completion time from startedAt to completedAt
  let avgCompletionTimeSecs: number | null = null;
  if (completed > 0) {
    const completedResponses = await prisma.response.findMany({
      where: { studyId, status: "COMPLETED", completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
    });

    const totalSecs = completedResponses.reduce((sum, r) => {
      if (!r.completedAt) return sum;
      return sum + (r.completedAt.getTime() - r.startedAt.getTime()) / 1000;
    }, 0);

    avgCompletionTimeSecs = Math.round(totalSecs / completedResponses.length);
  }

  return {
    totalResponses: total,
    completed,
    screenedOut,
    inProgress: counts["IN_PROGRESS"] || 0,
    abandoned: counts["ABANDONED"] || 0,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    screenOutRate: total > 0 ? Math.round((screenedOut / total) * 100) : 0,
    avgCompletionTimeSecs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-question aggregation
// ─────────────────────────────────────────────────────────────────────────────

export interface ListResult {
  value: string;
  count: number;
  percentage: number;
}

export interface LikertResult {
  distribution: Record<number, number>;
  mean: number;
  median: number;
  n: number;
}

export interface NumericResult {
  mean: number;
  median: number;
  min: number;
  max: number;
  n: number;
}

export interface WriteInResult {
  responses: { text: string; answeredAt: Date }[];
  total: number;
}

export interface RankingResult {
  items: { value: string; avgRank: number; count: number }[];
}

export interface GridResult {
  cells: Record<string, Record<string, number>>;
  n: number;
}

export interface DialResult {
  responseCount: number;
  totalDataPoints: number;
  durationSecs: number;
}

export type QuestionResult =
  | { type: "list"; data: ListResult[] }
  | { type: "likert"; data: LikertResult }
  | { type: "numeric"; data: NumericResult }
  | { type: "write_in"; data: WriteInResult }
  | { type: "ranking"; data: RankingResult }
  | { type: "grid"; data: GridResult }
  | { type: "ab"; data: ListResult[] }
  | { type: "dial"; data: DialResult }
  | { type: "unsupported"; data: null };

export async function aggregateQuestion(
  questionId: string,
  questionType: string,
  studyId: string,
  segmentFilter?: { questionId: string; value: string }
): Promise<QuestionResult> {
  // Get completed response IDs, optionally filtered by segment
  let responseIds: string[] | undefined;
  if (segmentFilter) {
    const segmented = await prisma.answer.findMany({
      where: {
        questionId: segmentFilter.questionId,
        response: { studyId, status: "COMPLETED" },
      },
      select: { responseId: true, value: true },
    });

    responseIds = segmented
      .filter((a) => {
        const val = a.value as Record<string, unknown>;
        // Check various answer formats
        if (Array.isArray(val.selected)) return val.selected.includes(segmentFilter.value);
        if (typeof val.selected === "string") return val.selected === segmentFilter.value;
        if (typeof val.value === "number") return String(val.value) === segmentFilter.value;
        if (typeof val.text === "string") return val.text === segmentFilter.value;
        return false;
      })
      .map((a) => a.responseId);
  }

  const whereClause: Prisma.AnswerWhereInput = {
    questionId,
    response: { studyId, status: "COMPLETED" },
    ...(responseIds ? { responseId: { in: responseIds } } : {}),
  };

  const answers = await prisma.answer.findMany({
    where: whereClause,
    select: { value: true, answeredAt: true },
  });

  const n = answers.length;
  if (n === 0) {
    return { type: "unsupported", data: null };
  }

  switch (questionType) {
    case "STANDARD_LIST":
    case "WORD_LIST":
    case "IMAGE_LIST":
    case "AD_MOCK_UP":
    case "OVERALL_REACTION":
    case "SELECT_FROM_SET":
    case "MULTI_AD":
    case "COMPARISON": {
      const counts: Record<string, number> = {};
      for (const a of answers) {
        const val = a.value as Record<string, unknown>;
        const selected = (val.selected as string[]) || [];
        for (const s of Array.isArray(selected) ? selected : [selected]) {
          counts[String(s)] = (counts[String(s)] || 0) + 1;
        }
      }
      const data: ListResult[] = Object.entries(counts)
        .map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / n) * 100),
        }))
        .sort((a, b) => b.count - a.count);
      return { type: "list", data };
    }

    case "LIKERT":
    case "MULTI_LIKERT": {
      const values: number[] = answers.map((a) => {
        const val = a.value as Record<string, unknown>;
        return Number(val.value ?? 0);
      });
      values.sort((a, b) => a - b);

      const distribution: Record<number, number> = {};
      for (const v of values) {
        distribution[v] = (distribution[v] || 0) + 1;
      }

      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const median =
        values.length % 2 === 0
          ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
          : values[Math.floor(values.length / 2)];

      return {
        type: "likert",
        data: { distribution, mean: Math.round(mean * 100) / 100, median, n },
      };
    }

    case "NUMERIC": {
      const values: number[] = answers.map((a) => {
        const val = a.value as Record<string, unknown>;
        return Number(val.value ?? 0);
      });
      values.sort((a, b) => a - b);

      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const median =
        values.length % 2 === 0
          ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
          : values[Math.floor(values.length / 2)];

      return {
        type: "numeric",
        data: {
          mean: Math.round(mean * 100) / 100,
          median,
          min: values[0],
          max: values[values.length - 1],
          n,
        },
      };
    }

    case "WRITE_IN":
    case "CREATIVE_COPY": {
      const responses = answers.map((a) => {
        const val = a.value as Record<string, unknown>;
        return {
          text: String(val.text || (val.annotations as string[])?.[0] || ""),
          answeredAt: a.answeredAt,
        };
      });
      return { type: "write_in", data: { responses, total: n } };
    }

    case "LIST_RANKING": {
      const rankSums: Record<string, { total: number; count: number }> = {};
      for (const a of answers) {
        const val = a.value as Record<string, unknown>;
        const ranked = val.ranked as string[];
        if (!Array.isArray(ranked)) continue;
        ranked.forEach((item, index) => {
          if (!rankSums[item]) rankSums[item] = { total: 0, count: 0 };
          rankSums[item].total += index + 1;
          rankSums[item].count += 1;
        });
      }
      const items = Object.entries(rankSums)
        .map(([value, { total, count }]) => ({
          value,
          avgRank: Math.round((total / count) * 100) / 100,
          count,
        }))
        .sort((a, b) => a.avgRank - b.avgRank);
      return { type: "ranking", data: { items } };
    }

    case "GRID": {
      const cells: Record<string, Record<string, number>> = {};
      for (const a of answers) {
        const val = a.value as Record<string, unknown>;
        const values = val.values as Record<string, string>;
        if (!values) continue;
        for (const [row, col] of Object.entries(values)) {
          if (!cells[row]) cells[row] = {};
          cells[row][col] = (cells[row][col] || 0) + 1;
        }
      }
      return { type: "grid", data: { cells, n } };
    }

    case "TEXT_AB":
    case "IMAGE_AB": {
      const counts: Record<string, number> = {};
      for (const a of answers) {
        const val = a.value as Record<string, unknown>;
        const selected = String(val.selected || "");
        counts[selected] = (counts[selected] || 0) + 1;
      }
      const data: ListResult[] = Object.entries(counts)
        .map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / n) * 100),
        }))
        .sort((a, b) => b.count - a.count);
      return { type: "ab", data };
    }

    case "VIDEO_DIAL": {
      // Dial data is aggregated separately via aggregateDialData()
      // Here we just return summary stats so the results page knows there's data
      const dialPoints = await prisma.dialDataPoint.findMany({
        where: {
          questionId,
          response: { studyId, status: "COMPLETED" },
        },
        select: { second: true },
      });

      const maxSecond = dialPoints.reduce((max, dp) => Math.max(max, dp.second), 0);

      return {
        type: "dial",
        data: {
          responseCount: n,
          totalDataPoints: dialPoints.length,
          durationSecs: maxSecond + 1,
        },
      };
    }

    default:
      return { type: "unsupported", data: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dial data aggregation (uses DialDataPoint table for performance)
// ─────────────────────────────────────────────────────────────────────────────

export interface DialAggregation {
  second: number;
  mean: number;
  median: number;
  n: number;
}

export async function aggregateDialData(
  questionId: string,
  studyId: string,
  segmentFilter?: { questionId: string; value: string }
): Promise<DialAggregation[]> {
  // Get filtered response IDs
  let responseFilter: Prisma.DialDataPointWhereInput = {
    questionId,
    response: { studyId, status: "COMPLETED" },
  };

  if (segmentFilter) {
    const segmented = await prisma.answer.findMany({
      where: {
        questionId: segmentFilter.questionId,
        response: { studyId, status: "COMPLETED" },
      },
      select: { responseId: true, value: true },
    });

    const responseIds = segmented
      .filter((a) => {
        const val = a.value as Record<string, unknown>;
        if (Array.isArray(val.selected)) return val.selected.includes(segmentFilter.value);
        if (typeof val.value === "number") return String(val.value) === segmentFilter.value;
        return false;
      })
      .map((a) => a.responseId);

    responseFilter = {
      questionId,
      responseId: { in: responseIds },
    };
  }

  // Group by second with avg
  const grouped = await prisma.dialDataPoint.groupBy({
    by: ["second"],
    where: responseFilter,
    _avg: { value: true },
    _count: true,
    orderBy: { second: "asc" },
  });

  // For median, we need raw values per second — do a separate query
  const rawData = await prisma.dialDataPoint.findMany({
    where: responseFilter,
    select: { second: true, value: true },
    orderBy: { second: "asc" },
  });

  // Build median lookup
  const bySecond: Record<number, number[]> = {};
  for (const dp of rawData) {
    if (!bySecond[dp.second]) bySecond[dp.second] = [];
    bySecond[dp.second].push(dp.value);
  }

  return grouped.map((g) => {
    const values = (bySecond[g.second] || []).sort((a, b) => a - b);
    const median =
      values.length % 2 === 0
        ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
        : values[Math.floor(values.length / 2)];

    return {
      second: g.second,
      mean: Math.round((g._avg.value ?? 0) * 100) / 100,
      median,
      n: g._count,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbulb density aggregation
// ─────────────────────────────────────────────────────────────────────────────

export async function aggregateLightbulbs(
  questionId: string,
  studyId: string
): Promise<Record<number, number>> {
  const events = await prisma.dialEvent.findMany({
    where: {
      questionId,
      eventType: "lightbulb",
      response: { studyId, status: "COMPLETED" },
    },
    select: { timestamp: true },
  });

  const density: Record<number, number> = {};
  for (const e of events) {
    const second = Math.floor(Number(e.timestamp));
    density[second] = (density[second] || 0) + 1;
  }

  return density;
}
