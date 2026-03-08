import { create } from "zustand";
import type { QuestionData, QuestionOptionData } from "@/lib/types/question";
import type { StudyData } from "@/lib/types/study";

// ─────────────────────────────────────────────────────────────────────────────
// State shape — discriminated union eliminates null checks on study
// Data is separated from actions so serialization (future undo) is clean
// ─────────────────────────────────────────────────────────────────────────────

interface EditorData {
  study: StudyData;
  questions: QuestionData[];
  selectedQuestionId: string | null;
  activePhase: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
  /** Monotonic counter — incremented on every mutation. Used to prevent
   *  stale autosave responses from clearing isDirty. */
  version: number;
  /** Recently deleted question for undo-last-delete toast */
  lastDeleted: { question: QuestionData; timer: ReturnType<typeof setTimeout> } | null;
}

interface EditorActions {
  // Initialization
  hydrate: (study: StudyData, questions: QuestionData[]) => void;

  // Selection / view
  selectQuestion: (id: string | null) => void;
  setActivePhase: (phase: string) => void;

  // Question mutations (all mark dirty + bump version)
  updateQuestion: (id: string, patch: Partial<QuestionData>) => void;
  addQuestion: (question: QuestionData) => void;
  deleteQuestion: (id: string) => void;
  undoDelete: () => void;
  reorderQuestions: (reordered: QuestionData[]) => void;

  // Save lifecycle
  markSaving: () => void;
  markSaved: (atVersion: number) => void;
  markSaveError: (error: string, atVersion: number) => void;
  clearSaveError: () => void;
}

export type EditorStore = EditorData & EditorActions;

const UNDO_TIMEOUT_MS = 8_000;

export const useEditorStore = create<EditorStore>((set, get) => ({
  // ── Initial data (overwritten by hydrate) ──
  study: null as unknown as StudyData,
  questions: [],
  selectedQuestionId: null,
  activePhase: "ALL",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  saveError: null,
  version: 0,
  lastDeleted: null,

  // ── Initialization ──
  hydrate: (study, questions) =>
    set({
      study,
      questions,
      selectedQuestionId: null,
      activePhase: "ALL",
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      saveError: null,
      version: 0,
      lastDeleted: null,
    }),

  // ── Selection / view ──
  selectQuestion: (id) => set({ selectedQuestionId: id }),
  setActivePhase: (phase) => set({ activePhase: phase }),

  // ── Question mutations ──
  updateQuestion: (id, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
      isDirty: true,
      saveError: null,
      version: s.version + 1,
    })),

  addQuestion: (question) =>
    set((s) => ({
      questions: [...s.questions, question],
      selectedQuestionId: question.id,
      isDirty: true,
      saveError: null,
      version: s.version + 1,
    })),

  deleteQuestion: (id) => {
    const s = get();
    const question = s.questions.find((q) => q.id === id);
    if (!question) return;

    // Clear any previous undo timer
    if (s.lastDeleted) clearTimeout(s.lastDeleted.timer);

    const timer = setTimeout(() => {
      set({ lastDeleted: null });
    }, UNDO_TIMEOUT_MS);

    set({
      questions: s.questions.filter((q) => q.id !== id),
      selectedQuestionId:
        s.selectedQuestionId === id ? null : s.selectedQuestionId,
      lastDeleted: { question, timer },
      isDirty: true,
      saveError: null,
      version: s.version + 1,
    });
  },

  undoDelete: () => {
    const s = get();
    if (!s.lastDeleted) return;
    clearTimeout(s.lastDeleted.timer);
    const restored = s.lastDeleted.question;

    // Re-insert at original position
    const questions = [...s.questions];
    const insertAt = Math.min(restored.order, questions.length);
    questions.splice(insertAt, 0, restored);

    set({
      questions,
      selectedQuestionId: restored.id,
      lastDeleted: null,
      isDirty: true,
      version: s.version + 1,
    });
  },

  reorderQuestions: (reordered) =>
    set((s) => ({
      questions: reordered,
      isDirty: true,
      saveError: null,
      version: s.version + 1,
    })),

  // ── Save lifecycle ──
  markSaving: () => set({ isSaving: true }),

  markSaved: (atVersion) =>
    set((s) => ({
      isSaving: false,
      // Only clear dirty if no mutations happened since save started
      isDirty: s.version !== atVersion ? s.isDirty : false,
      lastSavedAt: new Date(),
      saveError: null,
    })),

  markSaveError: (error, atVersion) =>
    set((s) => ({
      isSaving: false,
      saveError: error,
      // Keep isDirty true so next autosave retry picks it up
    })),

  clearSaveError: () => set({ saveError: null }),
}));
