/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Env vars: TURNSTILE_SECRET_KEY
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResult {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // If no secret configured, skip verification (development mode)
  if (!secret) return true;

  try {
    const body: Record<string, string> = {
      secret,
      response: token,
    };
    if (remoteIp) body.remoteip = remoteIp;

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await res.json()) as TurnstileResult;
    return data.success;
  } catch {
    // Fail closed — reject if Turnstile is unreachable
    console.error("Turnstile verification request failed");
    return false;
  }
}
