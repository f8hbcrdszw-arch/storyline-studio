"use client";

import { useState } from "react";

export function ExportButton({ studyId }: { studyId: string }) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function handleExport(type: "CSV" | "JSON") {
    setExporting(true);
    setShowMenu(false);

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyId, type }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Export failed");
        return;
      }

      const data = await res.json();

      if (data.resultUrl) {
        // Download immediately
        window.open(data.resultUrl, "_blank");
      } else if (data.status === "PENDING") {
        alert("Export queued. Check back shortly.");
      }
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        {exporting ? "Exporting..." : "Export"}
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-md border border-border bg-background shadow-md min-w-[140px]">
            <button
              onClick={() => handleExport("CSV")}
              className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("JSON")}
              className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
