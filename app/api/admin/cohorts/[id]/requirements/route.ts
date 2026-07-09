import { NextRequest, NextResponse } from "next/server";
import { getCohort, setRequirementList } from "@/lib/store";
import { parseSubmissionCsv } from "@/lib/roster";

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

    const formData = await request.formData().catch(() => null);
    const week = formData?.get("week");
    if (week !== "week2" && week !== "week3") {
      return NextResponse.json({ error: "week must be 'week2' or 'week3'" }, { status: 400 });
    }

    const file = formData?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
    }

    const csvText = await file.text();
    const { submissions, skipped } = parseSubmissionCsv(csvText);

    if (submissions.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found in CSV", skipped },
        { status: 400 }
      );
    }

    const updatedCohort = await setRequirementList(cohortId, week, submissions);

    return NextResponse.json({
      week,
      count: submissions.length,
      skipped,
      rosterSize: updatedCohort.students.length,
    });
  } catch (error) {
    console.error("Failed to upload requirement list:", error);
    const message = error instanceof Error ? error.message : "Failed to upload requirement list";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
