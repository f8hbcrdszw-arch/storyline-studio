// Re-export survey components for cross-route-group use (e.g., admin live preview)
// The actual components live in (survey)/survey/[id]/components/ to keep survey bundle isolated.
// This barrel export allows admin code to import without reaching into the route group directly.

export { QuestionRenderer } from "@/app/(survey)/survey/[id]/components/QuestionRenderer";
