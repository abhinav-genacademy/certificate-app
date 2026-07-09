import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken, timingSafeEqualStrings } from "@/lib/auth";

export const ADMIN_BASE_HEADER = "x-admin-base";

// Machine-to-machine callers (e.g. a Google Apps Script tied to a quiz form)
// can't do cookie-based login, so this one endpoint additionally accepts a
// bearer token instead of the admin session cookie. Deliberately scoped to
// just this route — automation can add a completed student, nothing else.
const AUTOMATION_ROUTE_RE = /^\/api\/admin\/cohorts\/[^/]+\/students$/;

function getAdminPath(): string {
  const raw = process.env.ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, "");
  return raw && raw.length > 0 ? raw : "admin";
}

function hasValidAutomationKey(request: NextRequest): boolean {
  const key = process.env.AUTOMATION_API_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqualStrings(header.slice(7), key);
}

function rewriteToInternalAdmin(request: NextRequest, adminSegment: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin" + url.pathname.slice(adminSegment.length + 1);

  const headers = new Headers(request.headers);
  headers.set(ADMIN_BASE_HEADER, `/${adminSegment}`);
  return NextResponse.rewrite(url, { request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminPath = getAdminPath();
  const adminSegment = `/${adminPath}`;
  const isCustomAdminPath = adminPath !== "admin";

  // Hide the literal /admin route entirely once a custom secret path is set,
  // so it 404s like any other nonexistent page instead of revealing a login form.
  if (isCustomAdminPath && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return new NextResponse(null, { status: 404 });
  }

  const isAdminPageRequest = pathname === adminSegment || pathname.startsWith(`${adminSegment}/`);
  const isAdminApiRequest = pathname.startsWith("/api/admin");

  if (!isAdminPageRequest && !isAdminApiRequest) {
    return NextResponse.next();
  }

  if (
    request.method === "POST" &&
    AUTOMATION_ROUTE_RE.test(pathname) &&
    hasValidAutomationKey(request)
  ) {
    return NextResponse.next();
  }

  const isLoginPage = isAdminPageRequest && pathname === `${adminSegment}/login`;
  const isLoginApi = isAdminApiRequest && pathname === "/api/admin/login";

  if (isLoginPage) {
    return rewriteToInternalAdmin(request, adminPath);
  }
  if (isLoginApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const isAuthenticated = await verifyAdminToken(token);

  if (!isAuthenticated) {
    if (isAdminApiRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL(`${adminSegment}/login`, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPageRequest) {
    return rewriteToInternalAdmin(request, adminPath);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
