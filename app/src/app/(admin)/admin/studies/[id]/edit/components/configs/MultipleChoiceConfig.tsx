import type { ConfigProps } from "./types";

export function MultipleChoiceConfig({ config, onUpdate, isLocked }: ConfigProps) {
  const displayStyle = (config.displayStyle as string) || "list";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Display Style
        </label>
        <div className="flex gap-1">
          {[
            { value: "list", label: "List", icon: "≡" },
            { value: "bubbles", label: "Bubbles", icon: "◉" },
            { value: "images", label: "Images", icon: "▣" },
          ].map((style) => (
            <button
              key={style.value}
              onClick={() => onUpdate("displayStyle", style.value)}
              disabled={isLocked}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all ${
                displayStyle === style.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              } disabled:opacity-50`}
            >
              <span className="text-[10px]">{style.icon}</span>
              {style.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-xs flex items-center gap-1.5">
          Max select:
          <input
            type="number"
            value={(config.maxSelect as number) ?? ""}
            onChange={(e) =>
              onUpdate("maxSelect", e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={isLocked}
            min={1}
            placeholder="∞"
            className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={(config.randomizeOptions as boolean) || false}
            onChange={(e) => onUpdate("randomizeOptions", e.target.checked)}
            disabled={isLocked}
            className="rounded"
          />
          Randomize order
        </label>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={(config.includeOther as boolean) || false}
            onChange={(e) => onUpdate("includeOther", e.target.checked)}
            disabled={isLocked}
            className="rounded"
          />
          Include &ldquo;Other&rdquo;
        </label>
      </div>
    </div>
  );
}
