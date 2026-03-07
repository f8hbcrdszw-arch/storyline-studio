import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { StudyEditor } from "./components/StudyEditor";

export default async function StudyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const study = await prisma.study.findUnique({
    where: { id, createdBy: user.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
          mediaItems: true,
        },
      },
      _count: { select: { responses: true } },
    },
  });

  if (!study) notFound();

  const isLocked = study.status !== "DRAFT" && study._count.responses > 0;

  return (
    <StudyEditor
      study={{
        id: study.id,
        title: study.title,
        description: study.description,
        status: study.status,
        settings: study.settings as Record<string, unknown>,
        responseCount: study._count.responses,
      }}
      initialQuestions={study.questions.map((q) => ({
        id: q.id,
        phase: q.phase,
        type: q.type,
        order: q.order,
        title: q.title,
        prompt: q.prompt,
        config: q.config as Record<string, unknown>,
        required: q.required,
        isScreening: q.isScreening,
        skipLogic: q.skipLogic as Record<string, unknown>[] | null,
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          value: o.value,
          order: o.order,
          imageUrl: o.imageUrl,
        })),
        mediaItems: q.mediaItems.map((m) => ({
          id: m.id,
          source: m.source,
          url: m.url,
          youtubeId: m.youtubeId,
          filename: m.filename,
          type: m.type,
          durationSecs: m.durationSecs,
          thumbnailUrl: m.thumbnailUrl,
        })),
      }))}
      isLocked={isLocked}
    />
  );
}
