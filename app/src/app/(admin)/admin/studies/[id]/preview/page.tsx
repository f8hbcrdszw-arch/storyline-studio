import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PreviewShell } from "./components/PreviewShell";
import type { QuestionData } from "@/lib/types/question";

export default async function PreviewPage({
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
    select: {
      id: true,
      title: true,
      slug: true,
      settings: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          phase: true,
          order: true,
          title: true,
          prompt: true,
          config: true,
          required: true,
          isScreening: true,
          skipLogic: true,
          options: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              label: true,
              value: true,
              order: true,
              imageUrl: true,
            },
          },
          mediaItems: {
            select: {
              id: true,
              source: true,
              youtubeId: true,
              type: true,
              durationSecs: true,
              thumbnailUrl: true,
            },
          },
        },
      },
    },
  });

  if (!study) notFound();

  return (
    <PreviewShell
      studyId={study.id}
      studyTitle={study.title}
      slug={study.slug || study.id}
      questions={study.questions as QuestionData[]}
    />
  );
}
