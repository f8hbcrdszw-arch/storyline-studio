"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExportButton({ studyId }: { studyId: string }) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { toast } = useToast();

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
        toast(err.error || "Export failed", "error");
        return;
      }

      const data = await res.json();

      if (data.resultUrl) {
        window.open(data.resultUrl, "_blank");
        toast("Export downloaded", "success");
      } else if (data.status === "PENDING") {
        toast("Export queued. Check back shortly.", "default");
      }
    } catch {
      toast("Export failed. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowMenu(!showMenu)}
        loading={exporting}
      >
        Export
      </Button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-border bg-card shadow-lg min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150">
            <button
              onClick={() => handleExport("CSV")}
              className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent/50"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("JSON")}
              className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent/50"
            >
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
