import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SurveyShell } from "./components/SurveyShell";
import { SurveyThemeProvider } from "@/components/survey/ThemeProvider";
import type { SurveyTheme } from "@/lib/types/json-fields";

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id: slugOrId } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  // UUID regex to determine if this is an ID or slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  // Look up study by slug or ID
  const study = await prisma.study.findFirst({
    where: isUuid
      ? { OR: [{ slug: slugOrId }, { id: slugOrId }] }
      : { slug: slugOrId },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      settings: true,
    },
  });

  if (!study) notFound();

  if (!isPreview && study.status !== "ACTIVE") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <h1 className="text-xl font-medium text-foreground mb-2">
          Survey Unavailable
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {study.status === "CLOSED" || study.status === "ARCHIVED"
            ? "This survey is no longer accepting responses."
            : study.status === "PAUSED"
              ? "This survey is temporarily paused. Please check back later."
              : "This survey is not currently available."}
        </p>
      </div>
    );
  }

  const settings = study.settings as Record<string, unknown>;
  const theme = (settings?.theme as SurveyTheme) ?? null;

  return (
    <SurveyThemeProvider theme={theme}>
      <SurveyShell
        studyId={study.id}
        studyTitle={study.title}
        slug={study.slug || study.id}
        settings={settings}
        preview={isPreview}
      />
    </SurveyThemeProvider>
  );
}
