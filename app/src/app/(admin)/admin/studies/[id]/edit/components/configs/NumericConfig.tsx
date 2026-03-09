import type { ConfigProps } from "./types";

export function NumericConfig({ config, onUpdate, isLocked }: ConfigProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs">
        Min:
        <input
          type="number"
          value={(config.minValue as number) ?? ""}
          onChange={(e) =>
            onUpdate("minValue", e.target.value ? Number(e.target.value) : undefined)
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
        />
      </label>
      <label className="text-xs">
        Max:
        <input
          type="number"
          value={(config.maxValue as number) ?? ""}
          onChange={(e) =>
            onUpdate("maxValue", e.target.value ? Number(e.target.value) : undefined)
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
        />
      </label>
      <label className="text-xs">
        Step:
        <input
          type="number"
          value={(config.step as number) ?? ""}
          onChange={(e) =>
            onUpdate("step", e.target.value ? Number(e.target.value) : undefined)
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
        />
      </label>
    </div>
  );
}
