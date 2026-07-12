import { NextRequest } from "next/server";
import { query, sql } from "@/lib/db-client";

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Postgres-backed fixed-window limiter — fine at this app's traffic level,
// no new infra (Redis/KV) needed. Not perfectly race-free under heavy
// concurrency, only meant to blunt abuse, not guarantee an exact ceiling.
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  await query(sql`
    DELETE FROM rate_limit_hits
    WHERE bucket = ${bucket} AND created_at < now() - make_interval(secs => ${windowSeconds})
  `);
  const rows = await query<{ count: string }>(sql`
    SELECT count(*) FROM rate_limit_hits WHERE bucket = ${bucket}
  `);
  if (Number(rows[0]?.count ?? 0) >= limit) return false;
  await query(sql`INSERT INTO rate_limit_hits (bucket) VALUES (${bucket})`);
  return true;
}
