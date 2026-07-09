import { NextRequest, NextResponse } from "next/server";
import { createCohort } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const courseName = typeof body?.courseName === "string" ? body.courseName.trim() : "";
  const cohortLabel = typeof body?.cohortLabel === "string" ? body.cohortLabel.trim() : "";

  if (!courseName || !cohortLabel) {
    return NextResponse.json(
      { error: "courseName and cohortLabel are required" },
      { status: 400 }
    );
  }

  try {
    const cohort = await createCohort({ courseName, cohortLabel });
    return NextResponse.json({ cohort });
  } catch (error) {
    console.error("Failed to create cohort:", error);
    const message = error instanceof Error ? error.message : "Failed to create cohort";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
