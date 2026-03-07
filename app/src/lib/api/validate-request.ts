import { NextRequest, NextResponse } from "next/server";

/**
 * Validates that state-changing requests have JSON Content-Type.
 * This serves as CSRF protection — HTML forms cannot send application/json,
 * so cross-site form submissions will be rejected.
 */
export function validateJsonContentType(
  request: NextRequest
): NextResponse | null {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }
  }
  return null;
}

/**
 * Validates Origin header matches the expected origin.
 * Provides additional CSRF protection beyond Content-Type checking.
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // In development, skip origin check
    if (process.env.NODE_ENV === "development") return null;

    if (origin && host && !origin.endsWith(host)) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }
  }
  return null;
}
