import { NextRequest, NextResponse } from "next/server";
import { getCohort, getMissingRequirements, getWeeklySubmissions, upsertRoster } from "@/lib/store";
import { EMAIL_RE } from "@/lib/roster";
import { generateCertificateForStudent } from "@/lib/generate-certificate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  try {
    const cohort = await getCohort(cohortId);
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const generateImmediately = Boolean(body?.generateImmediately);
    const requireExisting = Boolean(body?.requireExisting);

    if (!firstName) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const {
      created,
      updated,
      skipped,
      cohort: updatedCohort,
    } = await upsertRoster(cohortId, [{ firstName, lastName, email }], { requireExisting });

    if (skipped > 0) {
      return NextResponse.json({
        created,
        updated,
        skipped: true,
        message: "This email isn't on the cohort's roster — not added, no certificate issued.",
      });
    }

    if (!generateImmediately) {
      return NextResponse.json({ created, updated });
    }

    const student = updatedCohort.students.find((s) => s.email === email);
    if (!student) {
      return NextResponse.json({ created, updated });
    }

    if (student.revokedAt) {
      // Never auto-regenerate a revoked certificate.
      return NextResponse.json({ created, updated });
    }

    if (!student.credentialId && student.source !== "manual") {
      const [week2, week3] = await Promise.all([
        getWeeklySubmissions(cohortId, "week2"),
        getWeeklySubmissions(cohortId, "week3"),
      ]);
      const missing = getMissingRequirements(week2, week3, student.email);
      if (missing.length > 0) {
        return NextResponse.json({
          created,
          updated,
          eligible: false,
          missingRequirements: missing,
          message: `Please submit the following before your certificate can be issued: ${missing.join(", ")}.`,
        });
      }
    }

    // Reuse the cohort we already have in hand instead of re-reading it —
    // a read immediately after upsertRoster's write can lag (Blob's list()
    // lookup isn't guaranteed instant-consistent with a just-completed write).
    const result = student.credentialId
      ? { credentialId: student.credentialId, certificateUrl: student.certificateUrl! }
      : await generateCertificateForStudent(updatedCohort, student.id);

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

    return NextResponse.json({
      created,
      updated,
      credentialId: result.credentialId,
      certificateUrl: result.certificateUrl,
      verifyUrl: `${baseUrl}/verify/${result.credentialId}`,
    });
  } catch (error) {
    console.error("Failed to add student:", error);
    const message = error instanceof Error ? error.message : "Failed to add student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
