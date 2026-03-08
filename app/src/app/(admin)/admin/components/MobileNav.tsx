"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, Menu, X } from "lucide-react";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="sm:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 sm:hidden border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 px-6 py-3 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
          <nav role="navigation">
            <Link
              href="/admin/studies"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary bg-primary/[0.08]"
            >
              <LayoutGrid className="w-4 h-4" />
              Studies
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
