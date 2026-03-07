import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  userId: string;
};

/**
 * Validates Supabase Auth session for admin API routes.
 * Returns the authenticated user ID or a 401 response.
 */
export async function requireAdmin(
  _request: NextRequest
): Promise<AdminContext | NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId: user.id };
}
