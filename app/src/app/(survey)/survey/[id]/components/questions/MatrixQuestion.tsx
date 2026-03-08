"use client";

import type { QuestionBodyProps } from "./types";

export default function MatrixQuestion({
  question,
  answer,
  onChange,
}: QuestionBodyProps) {
  const values = (answer as { values: Record<string, string> })?.values || {};
  const rows =
    (question.config.rows as { id: string; label: string }[]) || [];
  const columns =
    (question.config.columns as { id: string; label: string }[]) || [];

  const setCell = (rowId: string, colId: string) => {
    onChange({ values: { ...values, [rowId]: colId } });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2" />
            {columns.map((col) => (
              <th
                key={col.id}
                className="p-2 text-center text-xs text-muted-foreground font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-2 text-foreground">{row.label}</td>
              {columns.map((col) => (
                <td key={col.id} className="p-2 text-center">
                  <button
                    onClick={() => setCell(row.id, col.id)}
                    className={`w-8 h-8 rounded-full border transition-colors ${
                      values[row.id] === col.id
                        ? "border-primary bg-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                    aria-label={`${row.label}: ${col.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
