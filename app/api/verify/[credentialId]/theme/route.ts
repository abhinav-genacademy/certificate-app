import { NextRequest, NextResponse } from "next/server";
import { findByCredentialId } from "@/lib/store";
import { generateCertificateForStudent } from "@/lib/generate-certificate";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { CertificateTheme } from "@/lib/certificate-template";

export const runtime = "nodejs";
export const maxDuration = 60;

// Public, unauthenticated — anyone with a /verify/<credentialId> link can
// restyle that one certificate. Safe against enumeration since credential
// IDs are derived from a SHA-256 hash (see lib/credential.ts), not
// sequential or guessable, but a match here can still trigger a real
// Chromium render, so it's rate-limited the same as the old public claim
// endpoint was.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const { credentialId } = await params;
  const ip = getClientIp(request);

  if (!(await checkRateLimit(`theme:${credentialId}`, 10, 60))) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a minute and try again." },
      { status: 429 }
    );
  }
  if (!(await checkRateLimit(`theme-ip:${ip}`, 20, 60))) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a minute and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const theme: CertificateTheme | null =
    body?.theme === "dark" ? "dark" : body?.theme === "light" ? "light" : null;
  if (!theme) {
    return NextResponse.json({ error: "theme must be \"light\" or \"dark\"" }, { status: 400 });
  }

  try {
    const match = await findByCredentialId(credentialId);
    if (!match || !match.student.certificateUrl) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }
    if (match.student.revokedAt) {
      return NextResponse.json({ error: "This certificate has been revoked" }, { status: 409 });
    }

    if (match.student.theme === theme) {
      return NextResponse.json({
        credentialId,
        certificateUrl: match.student.certificateUrl,
        theme,
      });
    }

    const result = await generateCertificateForStudent(match.cohort, match.student.id, { theme });

    return NextResponse.json({
      credentialId: result.credentialId,
      certificateUrl: result.certificateUrl,
      theme,
    });
  } catch (error) {
    console.error("Failed to switch certificate theme:", error);
    const message = error instanceof Error ? error.message : "Failed to update style";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
