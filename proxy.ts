import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken, hasValidAutomationKey } from "@/lib/auth";

export const ADMIN_BASE_HEADER = "x-admin-base";

// Machine-to-machine callers (e.g. a Google Apps Script tied to a quiz form)
// authenticate with a bearer token against this one fixed-purpose route
// instead of the admin cookie. It lives outside /api/admin entirely — never
// give it the run of the general admin students endpoint, and never let it
// carry client-supplied authorization flags (requireExisting, force, etc.);
// the route handler hardcodes those itself and re-checks the token again.
const AUTOMATION_ROUTE_RE = /^\/api\/automation\/cohorts\/[^/]+\/students$/;

function getAdminPath(): string {
  const raw = process.env.ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, "");
  return raw && raw.length > 0 ? raw : "admin";
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

  // The automation route is fixed-purpose and lives outside /api/admin, so
  // it's gated here on the bearer token alone rather than the admin cookie
  // flow below. The route handler re-verifies the token itself too.
  if (request.method === "POST" && AUTOMATION_ROUTE_RE.test(pathname)) {
    return hasValidAutomationKey(request)
      ? NextResponse.next()
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
