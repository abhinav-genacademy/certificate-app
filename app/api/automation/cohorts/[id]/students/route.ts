import { NextRequest, NextResponse } from "next/server";
import { getAssessmentScores, getCohort, getMissingRequirements, getWeeklySubmissions } from "@/lib/store";
import { EMAIL_RE } from "@/lib/roster";
import { generateCertificateForStudent } from "@/lib/generate-certificate";
import { hasValidAutomationKey } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Fixed-purpose endpoint for the Google Forms integration: given the email
// of someone who just passed the quiz, issue their certificate if they're
// already expected on the roster and eligible. Matched by email only — the
// form no longer collects a name, and this route never creates or renames a
// student, only confirms + generates for one that already exists. Every
// authorization decision here is hardcoded server-side (generation is
// always attempted for an existing, eligible match) — a bearer token can
// never make this route create an arbitrary student or skip the
// requirement check, unlike the admin-facing
// /api/admin/cohorts/[id]/students route it used to share.
//
// Logged to stdout rather than a DB table — searchable in Vercel's runtime
// logs, no extra storage to manage for what's a low-volume audit trail.
function logCall(cohortId: string, email: string, outcome: string, ip: string) {
  console.log(
    `[automation-audit] cohort=${cohortId} email=${email} outcome=${outcome} ip=${ip}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  const ip = getClientIp(request);

  // proxy.ts already checked this, but this route must not rely on
  // middleware alone for its authorization.
  if (!hasValidAutomationKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`automation:${ip}`, 20, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    logCall(cohortId, email, "invalid_input", ip);
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const cohort = await getCohort(cohortId);
    if (!cohort) {
      logCall(cohortId, email, "cohort_not_found", ip);
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const student = cohort.students.find((s) => s.email.toLowerCase() === email);
    if (!student) {
      logCall(cohortId, email, "skipped_not_on_roster", ip);
      return NextResponse.json({
        skipped: true,
        message: "This email isn't on the cohort's roster — no certificate issued.",
      });
    }

    if (student.revokedAt) {
      logCall(cohortId, email, "revoked_skip", ip);
      return NextResponse.json({ ok: true });
    }

    if (!student.credentialId && student.source !== "manual") {
      const [week2, week3, assessmentScores] = await Promise.all([
        getWeeklySubmissions(cohortId, "week2"),
        getWeeklySubmissions(cohortId, "week3"),
        getAssessmentScores(cohortId),
      ]);
      const missing = getMissingRequirements(week2, week3, assessmentScores, student.email);
      if (missing.length > 0) {
        logCall(cohortId, email, "missing_requirements", ip);
        return NextResponse.json({ eligible: false, missingRequirements: missing });
      }
    }

    const result = student.credentialId
      ? { credentialId: student.credentialId, certificateUrl: student.certificateUrl! }
      : await generateCertificateForStudent(cohort, student.id);

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    logCall(cohortId, email, "issued", ip);

    return NextResponse.json({
      credentialId: result.credentialId,
      certificateUrl: result.certificateUrl,
      verifyUrl: `${baseUrl}/verify/${result.credentialId}`,
    });
  } catch (error) {
    console.error("Automation add-student failed:", error);
    logCall(cohortId, email, "error", ip);
    const message = error instanceof Error ? error.message : "Failed to add student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
