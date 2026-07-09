import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, signAdminToken, timingSafeEqualStrings } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: "Server is not configured with admin credentials" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
  const passwordMatches = Boolean(password) && timingSafeEqualStrings(password, adminPassword);

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await signAdminToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
