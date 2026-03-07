"use client";

import { useState, useCallback } from "react";

interface LightbulbButtonProps {
  onTap: () => void;
  disabled?: boolean;
}

export function LightbulbButton({ onTap, disabled }: LightbulbButtonProps) {
  const [glowing, setGlowing] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onTap();
    setGlowing(true);
    setTimeout(() => setGlowing(false), 600);
  }, [onTap, disabled]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`relative flex items-center justify-center w-14 h-14 rounded-full border-2 transition-all duration-200 ${
        glowing
          ? "border-yellow-400 bg-yellow-50 shadow-[0_0_20px_rgba(250,204,21,0.5)]"
          : "border-border bg-background hover:border-yellow-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      aria-label="Mark a moment (lightbulb)"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={glowing ? "#facc15" : "none"}
        stroke={glowing ? "#ca8a04" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    </button>
  );
}
