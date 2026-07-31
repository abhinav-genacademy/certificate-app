import type { Browser } from "puppeteer-core";
import { deriveCredentialId } from "@/lib/credential";
import { renderCertificatePng } from "@/lib/certificate-render";
import { markStudentIssued, type Cohort } from "@/lib/store";

function formatIssuedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Takes an already-loaded Cohort rather than a cohortId so callers that just
// wrote/fetched the cohort don't force another Blob lookup right behind
// their own write — list()-backed lookups can lag briefly after a write.
export async function generateCertificateForStudent(
  cohort: Cohort,
  studentId: string,
  options?: { browser?: Browser }
) {
  const student = cohort.students.find((s) => s.id === studentId);
  if (!student) throw new Error("Student not found");

  const credentialId = student.credentialId ?? deriveCredentialId(cohort.id, studentId);
  const issuedAt = student.issuedAt ? new Date(student.issuedAt) : new Date();

  const png = await renderCertificatePng(
    {
      recipientName: student.name,
      courseName: cohort.courseName,
      issuedDateFormatted: formatIssuedDate(issuedAt),
      credentialId,
    },
    options?.browser
  );

  const issuedAtIso = issuedAt.toISOString();

  return markStudentIssued(cohort.id, studentId, {
    credentialId,
    certificatePng: png,
    issuedAt: issuedAtIso,
  });
}
