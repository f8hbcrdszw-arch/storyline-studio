import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Wraps an API route handler to catch errors and return safe responses.
 * Never exposes internal error details (Prisma, Postgres, etc.) to clients.
 * Generates a requestId for log correlation — returned in 500 responses.
 */
export function withErrorHandler<T extends Record<string, string> = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<T> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> }
  ): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const requestLogger = logger.child({
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
    });

    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        requestLogger.warn("Request validation failed", {
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });

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

      requestLogger.error("Unhandled API error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return NextResponse.json(
        { error: "An unexpected error occurred", requestId },
        { status: 500 }
      );
    }
  };
}
