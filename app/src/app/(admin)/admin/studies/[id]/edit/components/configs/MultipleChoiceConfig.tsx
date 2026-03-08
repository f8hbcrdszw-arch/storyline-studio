import type { ConfigProps } from "./types";

export function MultipleChoiceConfig({ config, onUpdate, isLocked }: ConfigProps) {
  const displayStyle = (config.displayStyle as string) || "list";

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Display Style
      </label>
      <div className="flex gap-1">
        {[
          { value: "list", label: "List" },
          { value: "bubbles", label: "Bubbles" },
          { value: "images", label: "Images" },
        ].map((style) => (
          <button
            key={style.value}
            onClick={() => onUpdate("displayStyle", style.value)}
            disabled={isLocked}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              displayStyle === style.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs">
          Max select:
          <input
            type="number"
            value={(config.maxSelect as number) ?? ""}
            onChange={(e) =>
              onUpdate("maxSelect", e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={isLocked}
            min={1}
            className="ml-1 w-16 rounded border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={(config.randomizeOptions as boolean) || false}
            onChange={(e) => onUpdate("randomizeOptions", e.target.checked)}
            disabled={isLocked}
            className="rounded"
          />
          Randomize
        </label>
      </div>
    </div>
  );
}
