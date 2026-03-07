import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Wraps an API route handler to catch errors and return safe responses.
 * Never exposes internal error details (Prisma, Postgres, etc.) to clients.
 */
export function withErrorHandler(
  handler: (
    request: Request,
    context: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }

      // Log the real error server-side
      console.error("[API Error]", error);

      // Return generic message to client
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  };
}
