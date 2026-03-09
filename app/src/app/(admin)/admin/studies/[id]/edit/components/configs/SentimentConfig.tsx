import type { ConfigProps } from "./types";

export function SentimentConfig({ config, onUpdate, isLocked }: ConfigProps) {
  const attributes = (config.attributes as string[]) || ["Positive", "Negative"];

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Sentiment Attributes
      </label>
      <p className="text-[10px] text-muted-foreground">
        Respondents will tag options with each attribute (e.g. Positive, Negative, Memorable).
      </p>
      {attributes.map((attr, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={attr}
            onChange={(e) => {
              const updated = [...attributes];
              updated[i] = e.target.value;
              onUpdate("attributes", updated);
            }}
            disabled={isLocked}
            placeholder="Attribute name"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
          />
          {!isLocked && attributes.length > 1 && (
            <button
              onClick={() => onUpdate("attributes", attributes.filter((_, j) => j !== i))}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!isLocked && attributes.length < 10 && (
        <button
          onClick={() => onUpdate("attributes", [...attributes, ""])}
          className="text-xs text-primary hover:underline"
        >
          + Add attribute
        </button>
      )}
    </div>
  );
}
