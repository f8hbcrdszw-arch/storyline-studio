"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

export function OverflowMenu({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleDuplicate = async () => {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/studies/${studyId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = await res.json();
      router.push(`/admin/studies/${data.id}/edit`);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150">
          <button
            onClick={handleDuplicate}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/50"
          >
            Duplicate Study
          </button>
        </div>
      )}
    </div>
  );
}
