import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/require-admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createSignedReadUrl } from "@/lib/storage";

// POST /api/signed-url — sign one or more R2 keys (admin only)
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { keys } = await request.json();

  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 20) {
    return NextResponse.json({ error: "Provide 1-20 keys" }, { status: 400 });
  }

  const urls: Record<string, string> = {};
  for (const key of keys) {
    if (typeof key === "string" && key.length > 0 && !key.startsWith("http")) {
      urls[key] = await createSignedReadUrl(key);
    }
  }

  return NextResponse.json({ urls });
});
