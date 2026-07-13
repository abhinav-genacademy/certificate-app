import { NextRequest, NextResponse } from "next/server";
import { getAssessmentScores, getCohort, getMissingRequirements, getWeeklySubmissions } from "@/lib/store";
import { generateCertificateForStudent } from "@/lib/generate-certificate";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 5;

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

    const body = await request.json().catch(() => ({}));
    const studentId = typeof body?.studentId === "string" ? body.studentId : undefined;
    // Only meaningful together with a single studentId — an explicit admin
    // action to force one specific person through regardless of the Week
    // 2/3 check (e.g. the lists have a name/email mismatch for them). Never
    // applies to the batch path, so a bulk "Generate" click can't silently
    // skip the requirement check.
    const force = Boolean(body?.force) && Boolean(studentId);

    const allPending = cohort.students.filter((s) => !s.credentialId);
    const pending = studentId
      ? allPending.filter((s) => s.id === studentId)
      : allPending.slice(0, BATCH_SIZE);

    const [week2, week3, assessmentScores] = await Promise.all([
      getWeeklySubmissions(cohortId, "week2"),
      getWeeklySubmissions(cohortId, "week3"),
      getAssessmentScores(cohortId),
    ]);

    const processed: string[] = [];
    const failed: { studentId: string; error: string }[] = [];
    const notEligible: { studentId: string; missingRequirements: string[] }[] = [];

    for (const student of pending) {
      const missing =
        force || student.source === "manual"
          ? []
          : getMissingRequirements(week2, week3, assessmentScores, student.email);
      if (missing.length > 0) {
        notEligible.push({ studentId: student.id, missingRequirements: missing });
        continue;
      }
      try {
        await generateCertificateForStudent(cohort, student.id);
        processed.push(student.id);
      } catch (error) {
        console.error(`Failed to generate certificate for student ${student.id}:`, error);
        failed.push({
          studentId: student.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Computed from the snapshot fetched above rather than re-reading the
    // cohort, since a read immediately after the writes above can lag.
    const remainingPending = allPending.length - processed.length;

    return NextResponse.json({
      processed: processed.length,
      failed,
      notEligible,
      remainingPending,
    });
  } catch (error) {
    console.error("Failed to generate certificates:", error);
    const message = error instanceof Error ? error.message : "Failed to generate certificates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
