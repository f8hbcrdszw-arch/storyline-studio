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

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 50;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(pct * 100);
    },
    []
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

  // Keyboard navigation for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue: number | null = null;
      const step = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          newValue = clamp(value + step);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          newValue = clamp(value - step);
          break;
        case "Home":
          newValue = 0;
          break;
        case "End":
          newValue = 100;
          break;
        default:
          return; // Don't prevent default for non-slider keys
      }

      e.preventDefault();
      onInteract();
      onChange(newValue);
    },
    [disabled, value, onChange, onInteract]
  );

  const leftLabel = mode === "sentiment" ? "Negative" : "0";
  const rightLabel = mode === "sentiment" ? "Positive" : "100";
  const thumbPosition = `${value}%`;

  const ariaLabel =
    mode === "sentiment"
      ? `Sentiment dial at ${value}. Use arrow keys to adjust.`
      : `Intensity dial at ${value} out of 100. Use arrow keys to adjust.`;

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

      {/* Track — acts as the slider container for ARIA */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={
          mode === "sentiment"
            ? `${value <= 33 ? "Negative" : value >= 67 ? "Positive" : "Neutral"}, ${value}`
            : `${value} out of 100`
        }
        aria-label={ariaLabel}
        aria-disabled={disabled}
        className="relative h-3 rounded-full cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        onKeyDown={handleKeyDown}
      >
        {/* Thumb — larger on mobile (36px) for better touch targets */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-foreground shadow-md transition-shadow ${
            isDragging ? "scale-105" : ""
          } w-7 h-7 sm:w-7 sm:h-7 max-[640px]:w-9 max-[640px]:h-9`}
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

      {/* Numeric tick marks */}
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
