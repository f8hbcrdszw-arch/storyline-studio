"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Split-pane editor layout with resizable panels
// Left: question list | Center: question editor | Right: live preview
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "storyline-editor-panels";
const MIN_LEFT = 220;
const MIN_CENTER = 360;
const MIN_RIGHT = 280;

interface PanelSizes {
  left: number;
  right: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

function loadSizes(): PanelSizes {
  if (typeof window === "undefined") return { left: 280, right: 380, leftCollapsed: false, rightCollapsed: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { left: 280, right: 380, leftCollapsed: false, rightCollapsed: false };
}

function saveSizes(sizes: PanelSizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {}
}

export function EditorLayout({
  saveBar,
  questionList,
  editor,
  preview,
  header,
}: {
  saveBar?: ReactNode;
  questionList: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  header: ReactNode;
}) {
  const [sizes, setSizes] = useState<PanelSizes>(loadSizes);

  const updateSizes = useCallback((patch: Partial<PanelSizes>) => {
    setSizes((prev) => {
      const next = { ...prev, ...patch };
      saveSizes(next);
      return next;
    });
  }, []);

  const toggleLeft = useCallback(() => {
    updateSizes({ leftCollapsed: !sizes.leftCollapsed });
  }, [sizes.leftCollapsed, updateSizes]);

  const toggleRight = useCallback(() => {
    updateSizes({ rightCollapsed: !sizes.rightCollapsed });
  }, [sizes.rightCollapsed, updateSizes]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Ambient save bar — 2px line at very top */}
      {saveBar}

      {/* Header bar */}
      <div className="shrink-0 border-b border-border/60 px-5 py-3">
        {header}
      </div>

      {/* Panels */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: question list */}
        {!sizes.leftCollapsed && (
          <>
            <div
              className="shrink-0 overflow-y-auto border-r border-border/40 bg-muted/20"
              style={{ width: sizes.left }}
            >
              <div className="p-3">{questionList}</div>
            </div>
            <PanelResizer
              onResize={(delta) => {
                updateSizes({ left: Math.max(MIN_LEFT, sizes.left + delta) });
              }}
            />
          </>
        )}

        {/* Center panel: question editor */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Panel toggle buttons */}
          <div className="flex items-center gap-1 px-4 pt-2">
            <button
              onClick={toggleLeft}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent transition-colors"
              title={sizes.leftCollapsed ? "Show question list" : "Hide question list"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              {sizes.leftCollapsed ? "Questions" : ""}
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleRight}
              className={`text-xs flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
                sizes.rightCollapsed
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                  : "text-primary bg-primary/5"
              }`}
              title={sizes.rightCollapsed ? "Show preview" : "Hide preview"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>
          </div>
          <div className="p-4">{editor}</div>
        </div>

        {/* Right panel: live preview */}
        {!sizes.rightCollapsed && (
          <>
            <PanelResizer
              onResize={(delta) => {
                // Negative delta = dragging left = panel grows
                updateSizes({ right: Math.max(MIN_RIGHT, sizes.right - delta) });
              }}
            />
            <div
              className="shrink-0 overflow-y-auto border-l border-border/40 bg-muted/10"
              style={{ width: sizes.right }}
            >
              {preview}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resizable panel divider
// ─────────────────────────────────────────────────────────────────────────────

function PanelResizer({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    },
    [onResize]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="separator"
      aria-label="Resize panel"
    >
      {/* Visible grab indicator */}
      <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
    </div>
  );
}
