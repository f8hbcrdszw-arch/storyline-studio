import type { ConfigProps } from "./types";

export function VideoDialConfig({ config, onUpdate, isLocked }: ConfigProps) {
  const mode = (config.mode as string) || "intensity";
  const actionButtons =
    (config.actionButtons as { id: string; label: string }[]) || [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Dial Mode
        </label>
        <select
          value={mode}
          onChange={(e) => onUpdate("mode", e.target.value)}
          disabled={isLocked}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
        >
          <option value="intensity">Intensity (0-100)</option>
          <option value="sentiment">Sentiment (Negative-Positive)</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Action Buttons (max 4)
        </label>
        {actionButtons.map((btn, i) => (
          <div key={btn.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={btn.label}
              onChange={(e) => {
                const updated = [...actionButtons];
                updated[i] = { ...btn, label: e.target.value };
                onUpdate("actionButtons", updated);
              }}
              disabled={isLocked}
              placeholder="Button label"
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
            />
            {!isLocked && (
              <button
                onClick={() =>
                  onUpdate("actionButtons", actionButtons.filter((_, j) => j !== i))
                }
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && actionButtons.length < 4 && (
          <button
            onClick={() =>
              onUpdate("actionButtons", [
                ...actionButtons,
                { id: `action_${actionButtons.length}`, label: "" },
              ])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add action button
          </button>
        )}
      </div>

      {/* Post-video open-end annotation */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Post-Video Open-End
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showAnnotation !== false}
              onChange={(e) => onUpdate("showAnnotation", e.target.checked)}
              disabled={isLocked}
              className="rounded border-input"
            />
            Show open-ended text field after video
          </label>
          {config.showAnnotation !== false && (
            <>
              <input
                type="text"
                value={(config.annotationPrompt as string) || ""}
                onChange={(e) => onUpdate("annotationPrompt", e.target.value)}
                disabled={isLocked}
                placeholder="Any additional thoughts? (optional)"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
              />
              <input
                type="text"
                value={(config.annotationPlaceholder as string) || ""}
                onChange={(e) => onUpdate("annotationPlaceholder", e.target.value)}
                disabled={isLocked}
                placeholder="Share your thoughts about the video..."
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
              />
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Video/media is configured in the Media section after saving.
      </p>
    </div>
  );
}
