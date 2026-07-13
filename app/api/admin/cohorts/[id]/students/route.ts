import { NextRequest, NextResponse } from "next/server";
import { getCohort, upsertRoster } from "@/lib/store";
import { EMAIL_RE } from "@/lib/roster";

// Admin manual-add only — reachable solely via the admin cookie (see
// proxy.ts). Always creates/updates the student outright and never
// generates a certificate; use the separate "Generate" action for that.
// The automation integration has its own endpoint at
// /api/automation/cohorts/[id]/students with its own fixed authorization.
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const { created, updated } = await upsertRoster(cohortId, [{ name, email }]);

    return NextResponse.json({ created, updated });
  } catch (error) {
    console.error("Failed to add student:", error);
    const message = error instanceof Error ? error.message : "Failed to add student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
