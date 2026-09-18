/**
 * Short-lived signed tokens that let a phone notification acknowledge a
 * reminder without the app being open (the service worker has no session).
 * Signed with the server-only cron secret; valid for 24 hours.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type DismissClaims = {
  userId: string;
  reminderId: string;
  occurrenceAt: string;
  exp: number;
};

function secret(): string | null {
  return process.env["LOVABLE_CRON_SECRET"] ?? null;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createDismissToken(
  claims: Omit<DismissClaims, "exp"> & { exp?: number },
): string | null {
  const key = secret();
  if (!key) return null;
  const body: DismissClaims = {
    ...claims,
    exp: claims.exp ?? Date.now() + 24 * 60 * 60 * 1000,
  };
  const payload = b64url(JSON.stringify(body));
  return `${payload}.${sign(payload, key)}`;
}

export function verifyDismissToken(token: string): DismissClaims | null {
  const key = secret();
  if (!key) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DismissClaims;
    if (!claims.userId || !claims.reminderId || !claims.occurrenceAt) return null;
    if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
