/**
 * Context-aware spring system for Storyline Studio.
 *
 * No presets. Every spring is tuned to the specific distance,
 * direction, and intent of the interaction it serves.
 */

/** Spring transition config compatible with motion v12+ */
interface SpringConfig {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Distance-aware springs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate spring parameters based on animation distance.
 * Short moves are snappy; long moves need more damping to avoid overshoot.
 */
export function springForDistance(px: number): SpringConfig {
  const absPx = Math.abs(px);
  return {
    type: "spring",
    stiffness: Math.max(180, 600 - absPx * 1.8),
    damping: Math.max(18, 14 + absPx * 0.06),
    mass: 0.5 + absPx * 0.002,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent-based springs
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_SPRINGS: Record<string, SpringConfig> = {
  /** User selected/clicked something — responsive, decisive */
  select: { type: "spring", stiffness: 500, damping: 32, mass: 0.5 },
  /** Card/panel expanding to reveal content */
  expand: { type: "spring", stiffness: 350, damping: 28, mass: 0.7 },
  /** Card/panel collapsing — slightly faster than expand (closing feels decisive) */
  collapse: { type: "spring", stiffness: 420, damping: 30, mass: 0.6 },
  /** Element being dragged — heavy, deliberate */
  drag: { type: "spring", stiffness: 200, damping: 22, mass: 1.1 },
  /** Element settling after drop — satisfying, single bounce */
  drop: { type: "spring", stiffness: 300, damping: 18, mass: 0.8 },
  /** Revealing new content (stagger children) */
  reveal: { type: "spring", stiffness: 380, damping: 26, mass: 0.6 },
  /** Dismissing/removing an element */
  dismiss: { type: "spring", stiffness: 450, damping: 28, mass: 0.5 },
  /** Micro-interaction (toggle, check, small state change) */
  micro: { type: "spring", stiffness: 600, damping: 35, mass: 0.3 },
};

export type MotionIntent = keyof typeof INTENT_SPRINGS;

export function springForIntent(intent: MotionIntent): SpringConfig {
  return { ...INTENT_SPRINGS[intent] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stagger utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate stagger delay for child index.
 * Later children get diminishing delays (first few are noticeable,
 * the rest catch up quickly — feels organic, not mechanical).
 */
export function staggerDelay(index: number, baseMs = 30): number {
  // Logarithmic falloff: 0→30ms, 1→24ms, 2→20ms, 5→15ms, 10→12ms
  return baseMs * (1 / (1 + index * 0.15));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reduced motion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Instant transition for users who prefer reduced motion.
 * Use as: transition={prefersReducedMotion ? instantTransition : spring}
 */
export const instantTransition = { duration: 0 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Common animation variants
// ─────────────────────────────────────────────────────────────────────────────

/** Fade in + slight upward drift — for content appearing */
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** Scale from point — for elements materializing */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

/** Slide + fade for list items */
export const listItem = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
};

/** Collapse horizontally — for dismissed options */
export const collapseX = {
  initial: { opacity: 0, width: 0, marginLeft: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0 },
  animate: { opacity: 1, width: "auto", marginLeft: undefined, marginRight: undefined, paddingLeft: undefined, paddingRight: undefined },
  exit: { opacity: 0, width: 0, marginLeft: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0 },
};
