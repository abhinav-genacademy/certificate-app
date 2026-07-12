import { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// In-memory fixed-window counter, scoped to one serverless instance — resets
// on cold start and isn't shared across instances, so it's not a hard global
// ceiling. Acceptable here: every endpoint this guards requires either an
// unguessable credential ID or a bearer token to reach at all, so the
// realistic threat is one caller hammering their own access, not distributed
// abuse across many instances. Kept `async` so existing `await` call sites
// don't need to change even though the check itself is synchronous.
const hits = new Map<string, number[]>();

export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const timestamps = (hits.get(bucket) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    hits.set(bucket, timestamps);
    return false;
  }

  timestamps.push(now);
  hits.set(bucket, timestamps);
  return true;
}
