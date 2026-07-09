import { headers } from "next/headers";
import { ADMIN_BASE_HEADER } from "@/proxy";

// Server Components render at the internal /admin/* path after the proxy's
// rewrite, so they can't tell what secret path the browser is actually on.
// The proxy forwards it via a request header instead.
export async function getAdminBasePath(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get(ADMIN_BASE_HEADER) ?? "/admin";
}
