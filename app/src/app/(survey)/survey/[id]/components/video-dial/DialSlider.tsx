"use client";

import { useCallback, useRef, useState } from "react";

interface DialSliderProps {
  value: number;
  onChange: (value: number) => void;
  onInteract: () => void;
  mode: "intensity" | "sentiment";
  disabled?: boolean;
}

export function DialSlider({
  value,
  onChange,
  onInteract,
  mode,
  disabled,
}: DialSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(pct * 100);
    },
    [value]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      onInteract();
      const newValue = getValueFromPosition(e.clientX);
      onChange(newValue);
    },
    [disabled, getValueFromPosition, onChange, onInteract]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;
      const newValue = getValueFromPosition(e.clientX);
      onChange(newValue);
    },
    [isDragging, disabled, getValueFromPosition, onChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const leftLabel = mode === "sentiment" ? "Negative" : "0";
  const rightLabel = mode === "sentiment" ? "Positive" : "100";
  const thumbPosition = `${value}%`;

  return (
    <div className="w-full select-none">
      {/* Value tooltip */}
      <div className="relative h-6 mb-1">
        <div
          className="absolute -translate-x-1/2 bg-foreground text-background text-xs font-mono rounded px-1.5 py-0.5"
          style={{ left: thumbPosition }}
        >
          {value}
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-3 rounded-full cursor-pointer touch-none"
        style={{
          background:
            mode === "sentiment"
              ? "linear-gradient(to right, #ef4444, #eab308, #22c55e)"
              : "linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border-2 border-foreground shadow-md transition-shadow"
          style={{
            left: thumbPosition,
            boxShadow: isDragging
              ? "0 0 0 4px rgba(0,0,0,0.1)"
              : undefined,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground font-mono">
          {leftLabel}
        </span>
        {mode === "sentiment" && (
          <span className="text-[10px] text-muted-foreground font-mono">
            Neutral
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">
          {rightLabel}
        </span>
      </div>

      {/* Numeric tick marks for accessibility */}
      <div className="flex justify-between mt-0.5 px-0.5">
        {[0, 25, 50, 75, 100].map((n) => (
          <span key={n} className="text-[8px] text-muted-foreground/50 font-mono">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
