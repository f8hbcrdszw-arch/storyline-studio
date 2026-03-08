// ─────────────────────────────────────────────────────────────────────────────
// Canonical study types — single source of truth
// ─────────────────────────────────────────────────────────────────────────────

import type { StudyStatus } from "../schemas/study";

/** Study data as used by the admin editor */
export interface StudyData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  settings: Record<string, unknown>;
  responseCount: number;
}
