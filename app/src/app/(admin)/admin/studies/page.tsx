import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function StudiesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const studies = await prisma.study.findMany({
    where: { createdBy: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { responses: true, questions: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Studies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your survey studies
          </p>
        </div>
        <Link href="/admin/studies/new" className={buttonVariants()}>
          New Study
        </Link>
      </div>

      {studies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No studies yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first study to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {studies.map((study) => (
            <Link
              key={study.id}
              href={`/admin/studies/${study.id}`}
              className="block rounded-lg border border-border p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">
                    {study.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {study._count.questions} questions
                    {" · "}
                    {study._count.responses} responses
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    study.status === "ACTIVE"
                      ? "bg-green-100 text-green-800"
                      : study.status === "DRAFT"
                        ? "bg-yellow-100 text-yellow-800"
                        : study.status === "CLOSED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {study.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
