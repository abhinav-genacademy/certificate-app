import type { Browser } from "puppeteer-core";
import { NextRequest, NextResponse } from "next/server";
import { getAssessmentScores, getCohort, getMissingRequirements, getWeeklySubmissions } from "@/lib/store";
import { generateCertificateForStudent } from "@/lib/generate-certificate";
import { launchBrowser } from "@/lib/certificate-render";

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

    // Renaming an issued student invalidates the image, but retains their
    // credential ID and original issue date. Include those images for repair.
    const allPending = cohort.students.filter((s) => !s.credentialId || !s.certificateUrl);
    // For the batch path (no studentId), scan every pending student for
    // eligibility — cheap, just in-memory comparisons — but only actually
    // render up to BATCH_SIZE certificates per call, since that's the
    // expensive Chromium part and what serverless time limits are about.
    // Scanning the whole list (not just the first BATCH_SIZE) matters:
    // ineligible students never get a credentialId, so if the batch were
    // limited to a fixed front slice of `allPending`, a run of ineligible
    // students at the front would permanently block eligible ones further
    // back from ever being examined, since they never leave the pending set
    // — the caller's "stop when a round makes no progress" loop would stall
    // there even though eligible students exist later in the list.
    // An explicit single-student request also repairs certificates issued
    // before name changes started invalidating stored images.
    const candidates = studentId ? cohort.students.filter((s) => s.id === studentId) : allPending;
    if (studentId && candidates.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const [week2, week3, assessmentScores] = await Promise.all([
      getWeeklySubmissions(cohortId, "week2"),
      getWeeklySubmissions(cohortId, "week3"),
      getAssessmentScores(cohortId),
    ]);

    const processed: string[] = [];
    const failed: { studentId: string; error: string }[] = [];
    const notEligible: { studentId: string; missingRequirements: string[] }[] = [];

    // Launched lazily on the first student that actually needs rendering
    // (so a call that turns out to have nothing eligible never pays for a
    // browser at all), then reused for the rest of this batch — Chromium
    // startup, not the render itself, is the dominant cost of generating
    // more than one certificate at a time.
    let browser: Browser | undefined;
    try {
      for (const student of candidates) {
        if (!studentId && processed.length >= BATCH_SIZE) break;

        // Correcting an issued image does not re-assess the credential.
        const missing =
          student.credentialId || force || student.source === "manual"
            ? []
            : getMissingRequirements(week2, week3, assessmentScores, student.email);
        if (missing.length > 0) {
          notEligible.push({ studentId: student.id, missingRequirements: missing });
          continue;
        }
        try {
          if (!browser) browser = await launchBrowser();
          await generateCertificateForStudent(cohort, student.id, { browser });
          processed.push(student.id);
        } catch (error) {
          console.error(`Failed to generate certificate for student ${student.id}:`, error);
          failed.push({
            studentId: student.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (error) {
          console.error("Failed to close shared render browser:", error);
        }
      }
    }

    // Computed from the snapshot fetched above rather than re-reading the
    // cohort, since a read immediately after the writes above can lag.
    const remainingPending = allPending.filter((s) => !processed.includes(s.id)).length;

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
