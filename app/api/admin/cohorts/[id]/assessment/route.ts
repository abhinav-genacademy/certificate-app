import { NextRequest, NextResponse } from "next/server";
import { getCohort, setAssessmentScores } from "@/lib/store";
import { parseAssessmentCsv } from "@/lib/roster";

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
    const file = formData?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
    }

    const csvText = await file.text();
    const { rows, skipped } = parseAssessmentCsv(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid email/score rows found in CSV", skipped },
        { status: 400 }
      );
    }

    await setAssessmentScores(cohortId, rows);

    return NextResponse.json({ count: rows.length, skipped });
  } catch (error) {
    console.error("Failed to upload assessment scores:", error);
    const message = error instanceof Error ? error.message : "Failed to upload assessment scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
