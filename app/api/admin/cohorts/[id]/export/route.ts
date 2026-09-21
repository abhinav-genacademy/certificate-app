import { NextRequest, NextResponse } from "next/server";
import { getCohort } from "@/lib/store";

function csvEscape(value: string): string {
  // Keep formulas as text even if a spreadsheet ignores leading whitespace/control characters.
  const text = /^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
  // Only students with an actual verify link — nothing to send someone who
  // hasn't been issued a certificate yet.
  const issued = cohort.students.filter((s) => s.credentialId);
  const rows = [
    ["Name", "Email", "Credential ID", "Verify Link"],
    ...issued.map((s) => [
      s.name,
      s.email,
      s.credentialId!,
      `${baseUrl}/verify/${s.credentialId}`,
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
