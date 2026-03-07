"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DialPlayback } from "./DialPlayback";

interface QuestionInfo {
  id: string;
  title: string;
  type: string;
  phase: string;
  order: number;
  isScreening: boolean;
  options: { id: string; label: string; value: string }[];
  mediaItems: { id: string; source: string; youtubeId: string | null; url: string | null }[];
}

interface ListResult {
  value: string;
  count: number;
  percentage: number;
}

interface LikertResult {
  distribution: Record<number, number>;
  mean: number;
  median: number;
  n: number;
}

interface NumericResult {
  mean: number;
  median: number;
  min: number;
  max: number;
  n: number;
}

interface WriteInResult {
  responses: { text: string; answeredAt: string }[];
  total: number;
}

interface RankingResult {
  items: { value: string; avgRank: number; count: number }[];
}

interface GridResult {
  cells: Record<string, Record<string, number>>;
  n: number;
}

interface DialAggregation {
  second: number;
  mean: number;
  median: number;
  n: number;
}

interface DialSummary {
  responseCount: number;
  totalDataPoints: number;
  durationSecs: number;
}

type QuestionResultData =
  | { type: "list"; data: ListResult[] }
  | { type: "likert"; data: LikertResult }
  | { type: "numeric"; data: NumericResult }
  | { type: "write_in"; data: WriteInResult }
  | { type: "ranking"; data: RankingResult }
  | { type: "grid"; data: GridResult }
  | { type: "ab"; data: ListResult[] }
  | { type: "dial"; data: DialSummary }
  | { type: "unsupported"; data: null };

export function QuestionResults({
  studyId,
  question,
  segmentFilter,
}: {
  studyId: string;
  question: QuestionInfo;
  segmentFilter?: { questionId: string; value: string };
}) {
  const [result, setResult] = useState<QuestionResultData | null>(null);
  const [dialData, setDialData] = useState<{
    dialData: DialAggregation[];
    lightbulbs: Record<number, number>;
    annotations?: { text: string; answeredAt: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (segmentFilter) {
          params.set("segmentQuestionId", segmentFilter.questionId);
          params.set("segmentValue", segmentFilter.value);
        }
        const qs = params.toString() ? `?${params.toString()}` : "";

        const res = await fetch(
          `/api/studies/${studyId}/results/questions/${question.id}${qs}`
        );
        if (!res.ok) throw new Error("Failed to load results");
        const data = await res.json();
        setResult(data);

        // For VIDEO_DIAL, also fetch dial data
        if (question.type === "VIDEO_DIAL") {
          const dialRes = await fetch(
            `/api/studies/${studyId}/results/dial/${question.id}${qs}`
          );
          if (dialRes.ok) {
            setDialData(await dialRes.json());
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [studyId, question.id, question.type, segmentFilter]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
        <div className="mx-auto w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto mb-2 text-destructive">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!result || result.type === "unsupported") {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No responses yet for this question.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-medium text-foreground">
          Q{question.order + 1}: {question.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
          {question.type.replace(/_/g, " ").toLowerCase()}
        </p>
      </div>

      {result.type === "list" && (
        <ListResultView data={result.data} options={question.options} />
      )}
      {result.type === "ab" && (
        <ABResultView data={result.data} options={question.options} />
      )}
      {result.type === "likert" && <LikertResultView data={result.data} />}
      {result.type === "numeric" && <NumericResultView data={result.data} />}
      {result.type === "write_in" && <WriteInResultView data={result.data} />}
      {result.type === "ranking" && (
        <RankingResultView data={result.data} options={question.options} />
      )}
      {result.type === "grid" && <GridResultView data={result.data} />}

      {question.type === "VIDEO_DIAL" && dialData && (
        <>
          {question.mediaItems[0] && (
            <DialPlayback
              questionId={question.id}
              mediaItem={question.mediaItems[0]}
              dialData={dialData.dialData}
              lightbulbs={dialData.lightbulbs}
            />
          )}
          <DialResultView data={dialData} questionId={question.id} />
        </>
      )}
    </div>
  );
}

// ─── List / Multi-select ─────────────────────────────────────────────────────

function ListResultView({
  data,
  options,
}: {
  data: ListResult[];
  options: { label: string; value: string }[];
}) {
  const optionMap = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{total} total selections</p>
      {data.map((item) => (
        <div key={item.value} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {optionMap[item.value] || item.value}
            </span>
            <span className="text-muted-foreground">
              {item.count} ({item.percentage}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── A/B Testing ─────────────────────────────────────────────────────────────

function ABResultView({
  data,
  options,
}: {
  data: ListResult[];
  options: { label: string; value: string }[];
}) {
  const optionMap = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{total} responses</p>
      <div className="flex gap-3">
        {data.map((item, i) => {
          const colors = ["bg-blue-500", "bg-amber-500"];
          return (
            <div
              key={item.value}
              className="flex-1 rounded-lg border border-border p-4 text-center"
            >
              <p className="text-sm font-medium text-foreground">
                {optionMap[item.value] || `Option ${String.fromCharCode(65 + i)}`}
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {item.percentage}%
              </p>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors[i] || "bg-primary"}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.count} votes
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Likert ──────────────────────────────────────────────────────────────────

function LikertResultView({ data }: { data: LikertResult }) {
  const labels: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Neutral",
    4: "Agree",
    5: "Strongly Agree",
  };

  const maxCount = Math.max(...Object.values(data.distribution), 1);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Mean:</span>{" "}
          <span className="font-medium text-foreground">{data.mean}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Median:</span>{" "}
          <span className="font-medium text-foreground">{data.median}</span>
        </div>
        <div>
          <span className="text-muted-foreground">n:</span>{" "}
          <span className="font-medium text-foreground">{data.n}</span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-32">
        {[1, 2, 3, 4, 5].map((val) => {
          const count = data.distribution[val] || 0;
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={val} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{count}</span>
              <div className="w-full flex items-end" style={{ height: "80px" }}>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${height}%`, minHeight: count > 0 ? "4px" : "0" }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {labels[val] || val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Numeric ─────────────────────────────────────────────────────────────────

function NumericResultView({ data }: { data: NumericResult }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: "Mean", value: data.mean },
        { label: "Median", value: data.median },
        { label: "Min", value: data.min },
        { label: "Max", value: data.max },
        { label: "n", value: data.n },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-medium text-foreground mt-0.5">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Write-in / Open-ended ───────────────────────────────────────────────────

function WriteInResultView({ data }: { data: WriteInResult }) {
  const [showAll, setShowAll] = useState(false);
  const displayResponses = showAll ? data.responses : data.responses.slice(0, 10);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {data.total} response{data.total !== 1 ? "s" : ""}
      </p>
      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {displayResponses.map((r, i) => (
          <div
            key={i}
            className="rounded border border-border p-2.5 text-sm text-foreground"
          >
            {r.text}
          </div>
        ))}
      </div>
      {data.total > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          Show all {data.total} responses
        </button>
      )}
    </div>
  );
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

function RankingResultView({
  data,
  options,
}: {
  data: RankingResult;
  options: { label: string; value: string }[];
}) {
  const optionMap = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 text-xs text-muted-foreground font-medium pb-1 border-b border-border">
        <span>#</span>
        <span>Item</span>
        <span>Avg Rank</span>
        <span>Count</span>
      </div>
      {data.items.map((item, i) => (
        <div
          key={item.value}
          className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center py-1.5 text-sm"
        >
          <span className="text-muted-foreground font-medium w-5 text-right">
            {i + 1}
          </span>
          <span className="text-foreground">
            {optionMap[item.value] || item.value}
          </span>
          <span className="text-muted-foreground">{item.avgRank}</span>
          <span className="text-muted-foreground">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Grid / Matrix ───────────────────────────────────────────────────────────

function GridResultView({ data }: { data: GridResult }) {
  const rows = Object.keys(data.cells);
  const colSet = new Set<string>();
  for (const row of rows) {
    for (const col of Object.keys(data.cells[row])) {
      colSet.add(col);
    }
  }
  const cols = Array.from(colSet);

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-muted-foreground mb-2">n = {data.n}</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 text-xs text-muted-foreground font-medium border-b border-border" />
            {cols.map((col) => (
              <th
                key={col}
                className="p-2 text-xs text-muted-foreground font-medium text-center border-b border-border"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="p-2 text-foreground font-medium border-b border-border">
                {row}
              </td>
              {cols.map((col) => {
                const count = data.cells[row]?.[col] || 0;
                const pct = data.n > 0 ? Math.round((count / data.n) * 100) : 0;
                return (
                  <td
                    key={col}
                    className="p-2 text-center border-b border-border"
                    style={{
                      backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(pct * 0.3)}%, transparent)`,
                    }}
                  >
                    <span className="text-foreground">{count}</span>
                    <span className="text-muted-foreground text-xs ml-1">
                      ({pct}%)
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Video Dial ──────────────────────────────────────────────────────────────

function DialResultView({
  data,
  questionId,
}: {
  data: {
    dialData: DialAggregation[];
    lightbulbs: Record<number, number>;
    annotations?: { text: string; answeredAt: string }[];
  };
  questionId: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleDownloadChart = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;

    const scale = 2;
    const svgW = 700;
    const svgH = parseInt(svg.getAttribute("viewBox")?.split(" ")[3] || "200");

    // Fetch brand font and convert to base64 for embedding
    let fontBase64 = "";
    try {
      const fontRes = await fetch("/fonts/SctoGroteskA-Regular.woff");
      const buf = await fontRes.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      fontBase64 = btoa(binary);
    } catch {
      // Fall through — export without brand font
    }

    // Clone and prepare for standalone rendering
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(svgW));
    clone.setAttribute("height", String(svgH));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Embed font as @font-face in SVG defs
    if (fontBase64) {
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `@font-face { font-family: 'SctoGrotesk'; src: url('data:font/woff;base64,${fontBase64}') format('woff'); font-weight: 400; }`;
      const defs = clone.querySelector("defs") || clone.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        clone.firstChild
      );
      defs.appendChild(style);
    }

    const fontFamily = fontBase64
      ? "'SctoGrotesk', system-ui, sans-serif"
      : "system-ui, sans-serif";

    // Inline CSS classes and set font on all text elements
    clone.querySelectorAll("[class]").forEach((el) => {
      const classes = el.getAttribute("class") || "";
      if (classes.includes("fill-muted-foreground")) {
        el.setAttribute("fill", "#6b7280");
      }
      el.removeAttribute("class");
    });
    clone.querySelectorAll("text").forEach((el) => {
      el.setAttribute("font-family", fontFamily);
    });
    clone.querySelectorAll("[stroke='currentColor']").forEach((el) => {
      el.setAttribute("stroke", "#d1d5db");
    });

    const svgStr = new XMLSerializer().serializeToString(clone);
    const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svgW * scale;
      canvas.height = svgH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, svgW, svgH);
      ctx.drawImage(img, 0, 0, svgW, svgH);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `dial-chart-${questionId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = dataUrl;
  }, [questionId]);

  if (data.dialData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">No dial data yet.</p>
      </div>
    );
  }

  const maxSecond = data.dialData[data.dialData.length - 1]?.second || 0;
  const respondentCount = data.dialData[0]?.n || 0;

  // Lightbulb markers (computed first so we know if row is needed)
  const lightbulbEntries = Object.entries(data.lightbulbs)
    .map(([sec, count]) => ({ second: Number(sec), count }))
    .filter((l) => l.second <= maxSecond);

  // SVG dimensions — with dedicated lightbulb row
  const width = 700;
  const lightbulbRowH = lightbulbEntries.length > 0 ? 22 : 0;
  const height = 200 + lightbulbRowH;
  const padding = { top: 10, right: 10, bottom: 30, left: 35 };
  const chartH = height - padding.top - padding.bottom - lightbulbRowH;
  const chartW = width - padding.left - padding.right;

  // Scale functions
  const xScale = (sec: number) =>
    padding.left + (sec / Math.max(maxSecond, 1)) * chartW;
  const yScale = (val: number) =>
    padding.top + chartH - (val / 100) * chartH;

  // Lightbulb row position
  const lbRowTop = padding.top + chartH + 4;

  // Dial color scale — matches the survey slider gradient
  function dialColor(val: number): string {
    if (val <= 25) return lerpColor([239, 68, 68], [249, 115, 22], val / 25);
    if (val <= 50) return lerpColor([249, 115, 22], [234, 179, 8], (val - 25) / 25);
    if (val <= 75) return lerpColor([234, 179, 8], [132, 204, 22], (val - 50) / 25);
    return lerpColor([132, 204, 22], [34, 197, 94], (val - 75) / 25);
  }

  function lerpColor(a: number[], b: number[], t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // Build color-coded line segments for the mean line
  const meanSegments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  for (let i = 0; i < data.dialData.length - 1; i++) {
    const d0 = data.dialData[i];
    const d1 = data.dialData[i + 1];
    const avgVal = (d0.mean + d1.mean) / 2;
    meanSegments.push({
      x1: xScale(d0.second),
      y1: yScale(d0.mean),
      x2: xScale(d1.second),
      y2: yScale(d1.mean),
      color: dialColor(avgVal),
    });
  }

  // Build fill area path under mean line
  const fillPath =
    data.dialData.length > 0
      ? `M${xScale(data.dialData[0].second)},${yScale(0)} ` +
        data.dialData.map((d) => `L${xScale(d.second)},${yScale(d.mean)}`).join(" ") +
        ` L${xScale(data.dialData[data.dialData.length - 1].second)},${yScale(0)} Z`
      : "";

  // Build median line path
  const medianPath = data.dialData
    .map((d, i) => `${i === 0 ? "M" : "L"}${xScale(d.second)},${yScale(d.median)}`)
    .join(" ");

  // Time axis ticks
  const tickCount = Math.min(10, maxSecond);
  const tickInterval = Math.ceil(maxSecond / tickCount);
  const ticks: number[] = [];
  for (let t = 0; t <= maxSecond; t += tickInterval) {
    ticks.push(t);
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Gradient ID for fill area
  const gradientId = "dial-fill-gradient";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>n = {respondentCount}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-1.5 rounded" style={{ background: "linear-gradient(to right, #ef4444, #eab308, #22c55e)" }} /> Mean
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: "#9ca3af" }} /> Median
          </span>
          {lightbulbEntries.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Moments
            </span>
          )}
        </div>
        <button
          onClick={handleDownloadChart}
          className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
        >
          Download Chart
        </button>
      </div>

      <div className="rounded-lg border border-border p-3 overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: "400px" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.08} />
              <stop offset="25%" stopColor="#f97316" stopOpacity={0.08} />
              <stop offset="50%" stopColor="#eab308" stopOpacity={0.08} />
              <stop offset="75%" stopColor="#84cc16" stopOpacity={0.10} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.12} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <g key={val}>
              <line
                x1={padding.left}
                y1={yScale(val)}
                x2={width - padding.right}
                y2={yScale(val)}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={padding.left - 5}
                y={yScale(val)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {val}
              </text>
            </g>
          ))}

          {/* 50 line (neutral) */}
          <line
            x1={padding.left}
            y1={yScale(50)}
            x2={width - padding.right}
            y2={yScale(50)}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeDasharray="4 2"
          />

          {/* Fill area under mean line */}
          {fillPath && (
            <path d={fillPath} fill={`url(#${gradientId})`} />
          )}

          {/* Median line — subtle gray */}
          <path
            d={medianPath}
            fill="none"
            stroke="#9ca3af"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="3 2"
          />

          {/* Mean line — color-coded segments */}
          {meanSegments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={seg.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ))}

          {/* ── Lightbulb / Moments row ─────────────────────── */}
          {lightbulbEntries.length > 0 && (
            <g>
              {/* Separator line */}
              <line
                x1={padding.left}
                y1={lbRowTop - 2}
                x2={width - padding.right}
                y2={lbRowTop - 2}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              {/* Row label */}
              <text
                x={padding.left - 5}
                y={lbRowTop + lightbulbRowH / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={8}
                fill="#facc15"
              >
                &#x1F4A1;
              </text>
              {/* Markers */}
              {lightbulbEntries.map((l) => {
                const cx = xScale(l.second);
                return (
                  <g key={l.second}>
                    {/* Vertical tick */}
                    <line
                      x1={cx}
                      y1={lbRowTop}
                      x2={cx}
                      y2={lbRowTop + lightbulbRowH - 4}
                      stroke="#facc15"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                    {/* Dot at top */}
                    <circle
                      cx={cx}
                      cy={lbRowTop + 4}
                      r={Math.min(3 + l.count * 0.5, 6)}
                      fill="#facc15"
                      opacity={0.9}
                    />
                    {/* Count label if > 1 */}
                    {l.count > 1 && (
                      <text
                        x={cx}
                        y={lbRowTop + lightbulbRowH - 2}
                        textAnchor="middle"
                        dominantBaseline="auto"
                        fontSize={7}
                        fill="#facc15"
                        opacity={0.7}
                      >
                        {l.count}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Time axis */}
          {ticks.map((t) => (
            <text
              key={t}
              x={xScale(t)}
              y={height - 5}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {formatTime(t)}
            </text>
          ))}
        </svg>
      </div>

      {/* Open-ended annotations */}
      {data.annotations && data.annotations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Open-Ended Responses ({data.annotations.length})
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.annotations.map((a, i) => (
              <div
                key={i}
                className="rounded border border-border p-2.5 text-sm text-foreground"
              >
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
