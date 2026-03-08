import type { ConfigProps } from "./types";

export function LikertConfig({ config, onUpdate, isLocked }: ConfigProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Likert Scale
      </label>
      <div className="flex items-center gap-3">
        <label className="text-xs">
          Scale points:
          <select
            value={(config.likertScale as number) || 7}
            onChange={(e) => onUpdate("likertScale", Number(e.target.value))}
            disabled={isLocked}
            className="ml-1 rounded border border-input bg-background px-1 py-0.5 text-sm"
          >
            {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          value={
            (config.likertLabels as { low: string; high: string })?.low || ""
          }
          onChange={(e) =>
            onUpdate("likertLabels", {
              ...(config.likertLabels as object),
              low: e.target.value,
            })
          }
          disabled={isLocked}
          placeholder="Low label"
          className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={
            (config.likertLabels as { low: string; high: string })?.high || ""
          }
          onChange={(e) =>
            onUpdate("likertLabels", {
              ...(config.likertLabels as object),
              high: e.target.value,
            })
          }
          disabled={isLocked}
          placeholder="High label"
          className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
