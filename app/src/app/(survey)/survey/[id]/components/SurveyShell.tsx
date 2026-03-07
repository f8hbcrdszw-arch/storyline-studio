"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { QuestionRenderer } from "./QuestionRenderer";

interface QuestionOption {
  id: string;
  label: string;
  value: string;
  order: number;
  imageUrl: string | null;
}

interface MediaItem {
  id: string;
  source: string;
  youtubeId: string | null;
  type: string;
  durationSecs: number | null;
  thumbnailUrl: string | null;
}

export interface SurveyQuestion {
  id: string;
  type: string;
  phase: string;
  order: number;
  title: string;
  prompt: string | null;
  config: Record<string, unknown>;
  required: boolean;
  isScreening: boolean;
  skipLogic: unknown;
  options: QuestionOption[];
  mediaItems: MediaItem[];
}

interface StudyData {
  id: string;
  title: string;
  settings: Record<string, unknown>;
  questions: SurveyQuestion[];
}

type Screen = "consent" | "survey" | "completed" | "screened_out" | "error";

export function SurveyShell({
  studyId,
  studyTitle,
  slug,
  settings,
}: {
  studyId: string;
  studyTitle: string;
  slug: string;
  settings: Record<string, unknown>;
}) {
  const [screen, setScreen] = useState<Screen>("consent");
  const [study, setStudy] = useState<StudyData | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allowBack = (settings.allowBackNavigation as boolean) ?? false;
  const showProgress = (settings.showProgress as boolean) ?? true;

  // Load study data
  const loadStudy = useCallback(async () => {
    try {
      const res = await fetch(`/api/surveys/${slug}`);
      if (!res.ok) {
        setScreen("error");
        return;
      }
      const data = await res.json();
      setStudy(data);
    } catch {
      setScreen("error");
    }
  }, [slug]);

  // Create or resume response
  const startSurvey = useCallback(async () => {
    if (!study) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start survey");
        return;
      }

      const response = await res.json();
      setResponseId(response.id);

      // Resume: populate answers from existing data
      if (response.answers?.length > 0) {
        const existingAnswers: Record<string, unknown> = {};
        let lastAnsweredIndex = 0;

        for (const a of response.answers) {
          existingAnswers[a.questionId] = a.value;
          const qIndex = study.questions.findIndex(
            (q) => q.id === a.questionId
          );
          if (qIndex > lastAnsweredIndex) lastAnsweredIndex = qIndex;
        }

        setAnswers(existingAnswers);
        // Resume from next unanswered question
        setCurrentIndex(
          Math.min(lastAnsweredIndex + 1, study.questions.length - 1)
        );
      }

      setScreen("survey");
    } catch {
      setError("Failed to start survey");
    } finally {
      setLoading(false);
    }
  }, [study, studyId]);

  // Load study data on mount
  useEffect(() => {
    loadStudy();
  }, [loadStudy]);

  const currentQuestion = study?.questions[currentIndex];
  const totalQuestions = study?.questions.length || 0;

  const submitAnswer = useCallback(
    async (value: unknown) => {
      if (!currentQuestion || !responseId) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId,
            questionId: currentQuestion.id,
            value,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to submit answer");
          setLoading(false);
          return;
        }

        const result = await res.json();

        // Store answer locally
        setAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: value,
        }));

        // Check for screen out
        if (result.screenOut) {
          setScreen("screened_out");
          setLoading(false);
          return;
        }

        // Determine next question
        let nextIndex = currentIndex + 1;

        // Handle skip logic
        if (result.skipToQuestionId && study) {
          const skipIndex = study.questions.findIndex(
            (q) => q.id === result.skipToQuestionId
          );
          if (skipIndex > currentIndex) {
            nextIndex = skipIndex;
          }
        }

        // Check if survey is complete
        if (nextIndex >= totalQuestions) {
          await completeSurvey();
          return;
        }

        setCurrentIndex(nextIndex);
      } catch {
        setError("Failed to submit answer");
      } finally {
        setLoading(false);
      }
    },
    [currentQuestion, responseId, currentIndex, totalQuestions, study]
  );

  const completeSurvey = useCallback(async () => {
    if (!responseId) return;

    try {
      await fetch(`/api/responses/${responseId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Complete anyway on client side
    }

    setScreen("completed");
  }, [responseId]);

  const goBack = useCallback(() => {
    if (currentIndex > 0 && allowBack) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, allowBack]);

  // Update browser history for back button support
  useEffect(() => {
    if (screen === "survey") {
      const state = { index: currentIndex };
      window.history.pushState(state, "", "");

      const handlePopState = (e: PopStateEvent) => {
        if (allowBack && e.state?.index !== undefined) {
          setCurrentIndex(e.state.index);
        } else {
          // Push state back to prevent leaving
          window.history.pushState(state, "", "");
        }
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [screen, currentIndex, allowBack]);

  // ─────────────────────────────────────────────────────────────────────────
  // Screens
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "error") {
    return (
      <SurveyLayout>
        <div className="text-center">
          <h1 className="mb-2">Survey Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This survey could not be loaded. Please try again later.
          </p>
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "consent") {
    return (
      <SurveyLayout>
        <div className="max-w-lg w-full mx-auto space-y-6">
          <div className="text-center">
            <h1>{studyTitle}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Thank you for participating in this study. Your responses are
              anonymous and will be used for research purposes only.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-sm">
              Before you begin
            </p>
            <p>
              By continuing, you consent to participate in this research study.
              Your responses are anonymous and no personally identifiable
              information is collected.
            </p>
            <p>
              This survey may include video content from YouTube. By proceeding,
              you acknowledge that YouTube&apos;s privacy policy applies when
              viewing embedded videos.
            </p>
            <p>
              A cookie will be stored on your device to save your progress.
            </p>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            onClick={startSurvey}
            disabled={loading || !study}
          >
            {loading ? "Starting..." : study ? "Begin Survey" : "Loading..."}
          </Button>
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "screened_out") {
    return (
      <SurveyLayout>
        <div className="text-center max-w-md mx-auto">
          <h1 className="mb-2">Thank You</h1>
          <p className="text-sm text-muted-foreground">
            Based on your responses, you do not qualify for this particular
            study. We appreciate your time.
          </p>
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "completed") {
    const redirectUrl = settings.completionRedirectUrl as string | undefined;

    return (
      <SurveyLayout>
        <div className="text-center max-w-md mx-auto space-y-4">
          <h1>Thank You!</h1>
          <p className="text-sm text-muted-foreground">
            Your responses have been recorded. Thank you for participating in
            this study.
          </p>
          {redirectUrl && (
            <a
              href={redirectUrl}
              className="text-sm text-primary hover:underline inline-block mt-2"
            >
              Continue &rarr;
            </a>
          )}
        </div>
      </SurveyLayout>
    );
  }

  // Survey screen
  return (
    <SurveyLayout>
      <div className="max-w-2xl w-full mx-auto flex flex-col min-h-[60vh]">
        {/* Progress */}
        {showProgress && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <span>
                {Math.round(((currentIndex + 1) / totalQuestions) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Question */}
        <div className="flex-1">
          {currentQuestion && (
            <QuestionRenderer
              key={currentQuestion.id}
              question={currentQuestion}
              existingAnswer={answers[currentQuestion.id]}
              onSubmit={submitAnswer}
              onBack={allowBack && currentIndex > 0 ? goBack : undefined}
              loading={loading}
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center mt-4">{error}</p>
        )}
      </div>
    </SurveyLayout>
  );
}

function SurveyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </div>
      <footer className="py-4 text-center">
        <p className="label-mono text-muted-foreground/50">
          Powered by Storyline
        </p>
      </footer>
    </div>
  );
}
