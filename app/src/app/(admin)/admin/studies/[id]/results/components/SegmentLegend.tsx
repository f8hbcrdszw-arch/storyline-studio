"use client";

interface SegmentInfo {
  label: string;
  color: string;
  n: number;
}

export function SegmentLegend({ segments }: { segments: SegmentInfo[] }) {
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
      {segments.map((seg) => (
        <span key={seg.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: seg.color,
              opacity: seg.label === "All" ? 0.4 : 1,
            }}
          />
          <span className={seg.label === "All" ? "text-muted-foreground/60" : ""}>
            {seg.label}
          </span>
          <span className="text-muted-foreground/50">(n={seg.n})</span>
        </span>
      ))}
    </div>
  );
}
