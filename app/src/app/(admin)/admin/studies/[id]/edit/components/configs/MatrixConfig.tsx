import type { ConfigProps } from "./types";

export function MatrixConfig({ config, onUpdate, isLocked }: ConfigProps) {
  const rows = (config.rows as { id: string; label: string }[]) || [];
  const columns = (config.columns as { id: string; label: string }[]) || [];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Rows
        </label>
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={row.label}
              onChange={(e) => {
                const updated = [...rows];
                updated[i] = { ...row, label: e.target.value };
                onUpdate("rows", updated);
              }}
              disabled={isLocked}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
            />
            {!isLocked && (
              <button
                onClick={() => onUpdate("rows", rows.filter((_, j) => j !== i))}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && (
          <button
            onClick={() =>
              onUpdate("rows", [...rows, { id: `row_${rows.length}`, label: "" }])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add row
          </button>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Columns
        </label>
        {columns.map((col, i) => (
          <div key={col.id} className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={col.label}
              onChange={(e) => {
                const updated = [...columns];
                updated[i] = { ...col, label: e.target.value };
                onUpdate("columns", updated);
              }}
              disabled={isLocked}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/50"
            />
            {!isLocked && (
              <button
                onClick={() => onUpdate("columns", columns.filter((_, j) => j !== i))}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && (
          <button
            onClick={() =>
              onUpdate("columns", [...columns, { id: `col_${columns.length}`, label: "" }])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add column
          </button>
        )}
      </div>
    </div>
  );
}
