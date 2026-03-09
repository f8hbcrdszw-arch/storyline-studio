"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { QuestionRenderer } from "./QuestionRenderer";
import type { QuestionData } from "@/lib/types/question";
import type { SurveyTheme } from "@/lib/types/json-fields";

/** @deprecated Use QuestionData from @/lib/types/question instead */
export type SurveyQuestion = QuestionData;

/** Estimate survey completion time from question types */
function estimateMinutes(questions: QuestionData[]): number {
  const AVG_SECONDS: Record<string, number> = {
    MULTIPLE_CHOICE: 15,
    LIKERT: 10,
    OPEN_TEXT: 45,
    NUMERIC: 10,
    AB_TEST: 20,
    RANKING: 30,
    MATRIX: 40,
    MULTI_ITEM_RATING: 25,
    SENTIMENT: 30,
    REACTION: 20,
    VIDEO_DIAL: 120, // video duration varies, use ~2 min estimate
  };
  const totalSeconds = questions.reduce(
    (sum, q) => sum + (AVG_SECONDS[q.type] ?? 20),
    0
  );
  return Math.max(1, Math.round(totalSeconds / 60));
}

interface StudyData {
  id: string;
  title: string;
  settings: Record<string, unknown>;
  questions: QuestionData[];
}

type Screen = "consent" | "survey" | "completed" | "screened_out" | "error";
type Direction = "forward" | "back";

export function SurveyShell({
  studyId,
  studyTitle,
  slug,
  settings,
  preview = false,
}: {
  studyId: string;
  studyTitle: string;
  slug: string;
  settings: Record<string, unknown>;
  preview?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>("consent");
  const [study, setStudy] = useState<StudyData | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Direction tracking for transition animation
  const [direction, setDirection] = useState<Direction>("forward");
  // Key to force re-mount + animation on question change
  const [transitionKey, setTransitionKey] = useState(0);

  const allowBack = (settings.allowBackNavigation as boolean) ?? false;
  const showProgress = (settings.showProgress as boolean) ?? true;
  const themeSettings = settings.theme as SurveyTheme | undefined;
  const progressBarStyle = themeSettings?.progressBarStyle ?? "line";

  // Thank you page customization from settings
  const thankYouHeading = (settings.thankYouHeading as string) || "Thank You!";
  const thankYouBody =
    (settings.thankYouBody as string) ||
    "Your responses have been recorded. Thank you for participating in this study.";
  const thankYouCtaLabel = settings.thankYouCtaLabel as string | undefined;
  const thankYouCtaUrl = settings.thankYouCtaUrl as string | undefined;

  // Load study data
  const loadStudy = useCallback(async () => {
    try {
      const url = `/api/surveys/${slug}${preview ? "?preview=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        setScreen("error");
        return;
      }
      const data = await res.json();
      setStudy(data);
    } catch {
      setScreen("error");
    }
  }, [slug, preview]);

  // Create or resume response
  const startSurvey = useCallback(async () => {
    if (!study) return;
    setLoading(true);
    setError("");

    if (preview) {
      setResponseId("preview");
      setScreen("survey");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
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
  }, [study, studyId, preview, turnstileToken]);

  // Load study data on mount
  useEffect(() => {
    loadStudy();
  }, [loadStudy]);

  const currentQuestion = study?.questions[currentIndex];
  const totalQuestions = study?.questions.length || 0;

  const navigateTo = useCallback((index: number, dir: Direction) => {
    setDirection(dir);
    setTransitionKey((k) => k + 1);
    setCurrentIndex(index);
  }, []);

  const submitAnswer = useCallback(
    async (value: unknown) => {
      if (!currentQuestion || !responseId) return;

      setLoading(true);
      setError("");

      if (preview) {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalQuestions) {
          setScreen("completed");
        } else {
          navigateTo(nextIndex, "forward");
        }
        setLoading(false);
        return;
      }

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

        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

        if (result.screenOut) {
          setScreen("screened_out");
          setLoading(false);
          return;
        }

        let nextIndex = currentIndex + 1;

        if (result.skipToQuestionId && study) {
          const skipIndex = study.questions.findIndex(
            (q) => q.id === result.skipToQuestionId
          );
          if (skipIndex > currentIndex) {
            nextIndex = skipIndex;
          }
        }

        if (nextIndex >= totalQuestions) {
          await completeSurvey();
          return;
        }

        navigateTo(nextIndex, "forward");
      } catch {
        setError("Failed to submit answer");
      } finally {
        setLoading(false);
      }
    },
    [currentQuestion, responseId, currentIndex, totalQuestions, study, preview, navigateTo]
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
      navigateTo(currentIndex - 1, "back");
    }
  }, [currentIndex, allowBack, navigateTo]);

  // Update browser history for back button support
  useEffect(() => {
    if (screen === "survey") {
      const state = { index: currentIndex };
      window.history.pushState(state, "", "");

      const handlePopState = (e: PopStateEvent) => {
        if (allowBack && e.state?.index !== undefined) {
          navigateTo(e.state.index, "back");
        } else {
          window.history.pushState(state, "", "");
        }
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [screen, currentIndex, allowBack, navigateTo]);

  // ─────────────────────────────────────────────────────────────────────────
  // Screens
  // ─────────────────────────────────────────────────────────────────────────

  // Loading skeleton while study data loads
  if (!study && screen === "consent") {
    return (
      <SurveyLayout>
        <div className="max-w-lg w-full mx-auto space-y-6" aria-busy="true" aria-label="Loading survey">
          <div className="text-center space-y-3">
            <div className="h-8 w-64 mx-auto bg-muted rounded animate-pulse" />
            <div className="h-4 w-80 mx-auto bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 mx-auto bg-muted rounded animate-pulse" />
          </div>
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-11 w-full bg-muted rounded-md animate-pulse" />
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "error") {
    return (
      <SurveyLayout>
        <div className="text-center screen-enter">
          <h1 className="mb-2">Survey Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This survey could not be loaded. Please try again later.
          </p>
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "consent") {
    const estMinutes = study ? estimateMinutes(study.questions) : null;

    return (
      <SurveyLayout>
        <div className="max-w-lg w-full mx-auto space-y-6 screen-enter">
          {/* Skip to survey content link for screen readers */}
          <a href="#survey-start" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-3 focus:py-1 focus:rounded focus:text-sm">
            Skip to survey
          </a>

          {preview && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
              <p className="text-sm font-medium text-amber-800">Preview Mode</p>
              <p className="text-xs text-amber-600">Responses are not recorded</p>
            </div>
          )}

          <div className="text-center">
            <h1 className="!text-2xl sm:!text-3xl">{studyTitle}</h1>
            <p className="text-sm text-muted-foreground/70 mt-3 leading-relaxed">
              Thank you for participating in this study. Your responses are
              anonymous and will be used for research purposes only.
            </p>
            {estMinutes && (
              <p className="text-xs text-muted-foreground/40 mt-2 inline-flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                ~{estMinutes} min
              </p>
            )}
          </div>

          {!preview && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-5 text-xs text-muted-foreground/60 space-y-2.5">
              <p className="font-medium text-foreground/80 text-sm">
                Before you begin
              </p>
              <p className="leading-relaxed">
                By continuing, you consent to participate in this research study.
                Your responses are anonymous and no personally identifiable
                information is collected.
              </p>
              <p className="leading-relaxed">
                This survey may include video content from YouTube. By proceeding,
                you acknowledge that YouTube&apos;s privacy policy applies when
                viewing embedded videos.
              </p>
              <p className="leading-relaxed">
                A cookie will be stored on your device to save your progress.
              </p>
            </div>
          )}

          {!preview && turnstileSiteKey && (
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              options={{ size: "invisible" }}
              onSuccess={setTurnstileToken}
            />
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            onClick={startSurvey}
            disabled={loading || !study || (!preview && !!turnstileSiteKey && !turnstileToken)}
          >
            {loading ? "Starting..." : study ? (preview ? "Begin Preview" : "Begin Survey") : "Loading..."}
          </Button>
        </div>
      </SurveyLayout>
    );
  }

  if (screen === "screened_out") {
    return (
      <SurveyLayout>
        <div className="text-center max-w-md mx-auto screen-enter">
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

    if (preview) {
      return (
        <SurveyLayout>
          <div className="text-center max-w-md mx-auto space-y-4 screen-enter">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <p className="text-sm font-medium text-amber-800">Preview Complete</p>
            </div>
            <CompletionCheckmark />
            <h1>Survey Finished</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ve reached the end of the survey. No responses were recorded.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setScreen("consent");
                setCurrentIndex(0);
                setAnswers({});
                setResponseId(null);
                setError("");
                setTransitionKey(0);
              }}
            >
              Restart Preview
            </Button>
          </div>
        </SurveyLayout>
      );
    }

    return (
      <SurveyLayout>
        <div className="text-center max-w-md mx-auto space-y-5 screen-enter" role="status">
          <CompletionCheckmark />
          <h1 className="!text-2xl">{thankYouHeading}</h1>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">{thankYouBody}</p>
          {thankYouCtaLabel && thankYouCtaUrl && (
            <a
              href={thankYouCtaUrl}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity mt-2"
            >
              {thankYouCtaLabel}
            </a>
          )}
          {redirectUrl && !thankYouCtaUrl && (
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
  const transitionClass =
    direction === "forward" ? "survey-enter-forward" : "survey-enter-back";

  return (
    <SurveyLayout>
      <div id="survey-start" className="max-w-2xl w-full mx-auto flex flex-col min-h-[60vh]">
        {/* Preview banner */}
        {preview && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-1.5 text-center mb-4">
            <p className="text-xs font-medium text-amber-700">
              Preview Mode — responses are not recorded
            </p>
          </div>
        )}

        {/* Progress — aria-live announces changes to screen readers */}
        {showProgress && progressBarStyle !== "hidden" && (
          <div className="mb-8" role="progressbar" aria-valuemin={0} aria-valuemax={totalQuestions} aria-valuenow={currentIndex + 1} aria-label={`Question ${currentIndex + 1} of ${totalQuestions}`}>
            {progressBarStyle === "fraction" ? (
              <div className="text-center text-[11px] text-muted-foreground/40 tabular-nums" aria-live="polite">
                {currentIndex + 1} / {totalQuestions}
              </div>
            ) : progressBarStyle === "dots" ? (
              <div className="flex justify-center gap-1.5" aria-hidden="true">
                {Array.from({ length: totalQuestions }, (_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i <= currentIndex ? "bg-primary scale-100" : "bg-border scale-75"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-between text-[11px] text-muted-foreground/40 mb-2 tabular-nums">
                  <span>
                    {currentIndex + 1} of {totalQuestions}
                  </span>
                  <span>
                    {Math.round(((currentIndex + 1) / totalQuestions) * 100)}%
                  </span>
                </div>
                <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full progress-bar-fill"
                    style={{
                      width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Question with direction-aware transition */}
        <div className="flex-1" role="form" aria-label={currentQuestion?.title ?? "Survey question"}>
          {currentQuestion && (
            <div key={transitionKey} className={transitionClass}>
              <QuestionRenderer
                key={currentQuestion.id}
                question={currentQuestion}
                existingAnswer={answers[currentQuestion.id]}
                onSubmit={submitAnswer}
                onBack={allowBack && currentIndex > 0 ? goBack : undefined}
                loading={loading}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center mt-4">{error}</p>
        )}
      </div>
    </SurveyLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion checkmark (SVG with draw animation)
// ─────────────────────────────────────────────────────────────────────────────

function CompletionCheckmark() {
  return (
    <div className="flex justify-center">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="32"
          cy="32"
          r="30"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary/20 check-circle"
        />
        <circle
          cx="32"
          cy="32"
          r="30"
          fill="currentColor"
          className="text-primary/10 check-circle"
        />
        <path
          d="M20 33 L28 41 L44 25"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary check-mark"
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout wrapper
// ─────────────────────────────────────────────────────────────────────────────

function SurveyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </div>
      <footer className="py-5 text-center">
        <span className="label-mono text-muted-foreground/30 inline-flex items-baseline gap-[0.35em]">
          Powered by
          <span className="font-display text-[11px] normal-case tracking-tight font-light">
            <span style={{ transform: "translateY(-0.04em)", display: "inline-block" }} aria-hidden="true">∴</span>{" "}Storyline
          </span>
        </span>
      </footer>
    </div>
  );
}
