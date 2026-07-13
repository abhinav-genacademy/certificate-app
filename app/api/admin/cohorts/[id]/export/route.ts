import { NextRequest, NextResponse } from "next/server";
import { getCohort } from "@/lib/store";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  const cohort = await getCohort(cohortId);
  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const rows = [
    ["First Name", "Last Name", "Email", "Credential ID", "Verify Link"],
    ...cohort.students.map((s) => [
      s.firstName,
      s.lastName,
      s.email,
      s.credentialId ?? "",
      s.credentialId ? `${baseUrl}/verify/${s.credentialId}` : "",
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  const fileName = `${cohort.courseName}-${cohort.cohortLabel}-certificates`
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}.csv"`,
    },
  });
}
