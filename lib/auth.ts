import { timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "gen_academy_admin_session";
const SESSION_DURATION = "30d";

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length to avoid leaking length via timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

// Shared by proxy.ts (fast-path gate before the request even reaches a route)
// and the automation route handler, which re-checks independently rather
// than trusting the proxy alone for its authorization.
export function hasValidAutomationKey(request: NextRequest): boolean {
  const key = process.env.AUTOMATION_API_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqualStrings(header.slice(7), key);
}
