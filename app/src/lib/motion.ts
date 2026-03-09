/**
 * Context-aware spring system for Storyline Studio.
 *
 * No presets. Every spring is tuned to the specific distance,
 * direction, and intent of the interaction it serves.
 *
 * Includes a frequency-aware tempo system that adapts animation
 * parameters to the user's interaction speed — fast scanning
 * gets snappier motion, slow crafting gets more luxurious springs.
 */

/** Spring transition config compatible with motion v12+ */
interface SpringConfig {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tempo tracker — frequency-aware animation system
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks recent interaction timestamps to derive a tempo multiplier.
 * Fast interactions → higher stiffness, more damping (snappier).
 * Slow interactions → default springs (more expressive).
 *
 * This is a singleton — one tempo for the whole editor.
 * Not a React hook; pure imperative for zero re-renders.
 */
class TempoTracker {
  private timestamps: number[] = [];
  private readonly windowMs = 10_000; // 10-second sliding window
  private readonly maxEvents = 20;

  /** Record an interaction (question select, option add, etc.) */
  record() {
    const now = Date.now();
    this.timestamps.push(now);
    // Trim old events
    if (this.timestamps.length > this.maxEvents) {
      this.timestamps = this.timestamps.slice(-this.maxEvents);
    }
  }

  /**
   * Get the current tempo multiplier.
   * Returns 0..1 where:
   *   0 = slow/idle (use full animation)
   *   1 = very fast scanning (suppress/speed up animation)
   *
   * Based on events-per-second in the sliding window.
   */
  get tempo(): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = this.timestamps.filter((t) => t > cutoff);
    if (recent.length < 2) return 0;

    // Events per second
    const span = (now - recent[0]) / 1000;
    if (span < 0.1) return 0;
    const eps = recent.length / span;

    // Map to 0..1: <0.5 eps = idle, >3 eps = fast scanning
    return Math.min(1, Math.max(0, (eps - 0.5) / 2.5));
  }

  /**
   * Whether the user is in rapid-fire mode (3+ actions in 3 seconds).
   * Use this to skip animations entirely for add/remove operations.
   */
  get isRapid(): boolean {
    return this.tempo > 0.6;
  }
}

export const tempo = new TempoTracker();

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

/**
 * Get a spring config for the given intent, adjusted for current tempo.
 * When the user is moving fast, springs get snappier (higher stiffness,
 * more damping, less mass → faster settle, less overshoot).
 */
export function springForIntent(intent: MotionIntent): SpringConfig {
  const base = { ...INTENT_SPRINGS[intent] };
  const t = tempo.tempo;

  if (t < 0.1) return base; // Idle — full expression

  // Interpolate toward snappy: stiffness up, damping up, mass down
  return {
    type: "spring",
    stiffness: base.stiffness + t * 200,
    damping: base.damping + t * 15,
    mass: (base.mass ?? 0.5) * (1 - t * 0.4),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stagger utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate stagger delay for child index.
 * Later children get diminishing delays (first few are noticeable,
 * the rest catch up quickly — feels organic, not mechanical).
 *
 * Tempo-aware: fast scanning reduces delays toward zero.
 */
export function staggerDelay(index: number, baseMs = 30): number {
  const t = tempo.tempo;
  // At high tempo, reduce stagger toward zero (don't slow the user down)
  const adjustedBase = baseMs * (1 - t * 0.8);
  // Logarithmic falloff: 0→30ms, 1→24ms, 2→20ms, 5→15ms, 10→12ms
  return adjustedBase * (1 / (1 + index * 0.15));
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
