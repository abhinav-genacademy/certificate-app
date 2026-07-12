import { NextRequest, NextResponse } from "next/server";
import { getCohort, getMissingRequirements, getWeeklySubmissions, upsertRoster } from "@/lib/store";
import { EMAIL_RE } from "@/lib/roster";
import { generateCertificateForStudent } from "@/lib/generate-certificate";
import { hasValidAutomationKey } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { query, sql } from "@/lib/db-client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Fixed-purpose endpoint for the Google Forms integration: add a student who
// completed the quiz and, if they're already expected on the roster and
// eligible, issue their certificate. Every authorization decision here is
// hardcoded server-side (requireExisting is always true, generation is
// always attempted) — a bearer token can never make this route create an
// arbitrary student or skip the requirement check, unlike the admin-facing
// /api/admin/cohorts/[id]/students route it used to share.
async function logCall(cohortId: string, email: string, outcome: string, ip: string) {
  try {
    await query(sql`
      INSERT INTO automation_audit_log (cohort_id, email, outcome, ip)
      VALUES (${cohortId}, ${email}, ${outcome}, ${ip})
    `);
  } catch (error) {
    console.error("Failed to write automation audit log:", error);
  }
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
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!firstName || !email || !EMAIL_RE.test(email)) {
    await logCall(cohortId, email, "invalid_input", ip);
    return NextResponse.json(
      { error: "A valid first name and email are required" },
      { status: 400 }
    );
  }

  try {
    const cohort = await getCohort(cohortId);
    if (!cohort) {
      await logCall(cohortId, email, "cohort_not_found", ip);
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const { skipped, cohort: updatedCohort } = await upsertRoster(
      cohortId,
      [{ firstName, lastName, email }],
      { requireExisting: true }
    );

    if (skipped > 0) {
      await logCall(cohortId, email, "skipped_not_on_roster", ip);
      return NextResponse.json({
        skipped: true,
        message: "This email isn't on the cohort's roster — not added, no certificate issued.",
      });
    }

    const student = updatedCohort.students.find((s) => s.email === email);
    if (!student) {
      await logCall(cohortId, email, "not_found_after_upsert", ip);
      return NextResponse.json({ ok: true });
    }

    if (student.revokedAt) {
      await logCall(cohortId, email, "revoked_skip", ip);
      return NextResponse.json({ ok: true });
    }

    if (!student.credentialId && student.source !== "manual") {
      const [week2, week3] = await Promise.all([
        getWeeklySubmissions(cohortId, "week2"),
        getWeeklySubmissions(cohortId, "week3"),
      ]);
      const missing = getMissingRequirements(week2, week3, student.email);
      if (missing.length > 0) {
        await logCall(cohortId, email, "missing_requirements", ip);
        return NextResponse.json({ eligible: false, missingRequirements: missing });
      }
    }

    const result = student.credentialId
      ? { credentialId: student.credentialId, certificateUrl: student.certificateUrl! }
      : await generateCertificateForStudent(updatedCohort, student.id);

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    await logCall(cohortId, email, "issued", ip);

    return NextResponse.json({
      credentialId: result.credentialId,
      certificateUrl: result.certificateUrl,
      verifyUrl: `${baseUrl}/verify/${result.credentialId}`,
    });
  } catch (error) {
    console.error("Automation add-student failed:", error);
    await logCall(cohortId, email, "error", ip);
    const message = error instanceof Error ? error.message : "Failed to add student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
